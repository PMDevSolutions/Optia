import { BACKEND_BASE_URL } from "@/lib/entitlement-keys";

// Client for the /license endpoints. Requests carry { licenseKey, installId }
// (activation claims a per-license seat; refresh requires an already-activated
// install). Responses envelope the raw JWS as { entitlement, ... } — callers
// only take the token and derive all state from its verified claims.

export type LicenseErrorCode = "invalid" | "rate_limited" | "server" | "network";

export class LicenseError extends Error {
  constructor(
    public code: LicenseErrorCode,
    message: string,
    public retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "LicenseError";
  }
}

interface LicenseRequest {
  licenseKey: string;
  installId: string;
}

async function extractErrorMessage(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as {
      error?: { message?: string };
      message?: string;
    };
    return body.error?.message ?? body.message ?? null;
  } catch {
    return null;
  }
}

async function postBackend(path: string, request: unknown): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${BACKEND_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    throw new LicenseError("network", "Could not reach the license server.");
  }
  if (response.ok) return response;

  const message = await extractErrorMessage(response);
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("Retry-After"));
    throw new LicenseError(
      "rate_limited",
      message ?? "Too many license requests. Please try again shortly.",
      Number.isFinite(retryAfter) ? retryAfter : undefined,
    );
  }
  if (response.status >= 500) {
    throw new LicenseError("server", message ?? "License server error.");
  }
  // 400/403/404: the license key is unknown, revoked, expired, or malformed
  throw new LicenseError("invalid", message ?? "This license key is not valid.");
}

async function fetchEntitlementToken(path: string, request: LicenseRequest): Promise<string> {
  const response = await postBackend(path, request);
  const body = (await response.json().catch(() => null)) as { entitlement?: string } | null;
  if (!body || typeof body.entitlement !== "string") {
    throw new LicenseError("server", "License server returned an unexpected response.");
  }
  return body.entitlement;
}

/** Exchanges a license key for a signed entitlement, claiming a seat for this install. */
export async function activateLicense(licenseKey: string, installId: string): Promise<string> {
  return fetchEntitlementToken("/license/activate", { licenseKey, installId });
}

/** Re-issues an entitlement for an already-activated install. */
export async function refreshEntitlementToken(
  licenseKey: string,
  installId: string,
): Promise<string> {
  return fetchEntitlementToken("/license/refresh", { licenseKey, installId });
}

/** Releases this install's seat. Best-effort: callers may ignore failures. */
export async function deactivateLicense(licenseKey: string, installId: string): Promise<void> {
  await postBackend("/license/deactivate", { licenseKey, installId });
}

/**
 * Creates a Stripe Billing Portal session for the license and returns its URL.
 * Billing is fully Stripe-hosted: the extension only ever handles this URL,
 * never card or payment data.
 */
export async function createBillingPortalSession(licenseKey: string): Promise<string> {
  const response = await postBackend("/billing/portal", { licenseKey });
  const body = (await response.json().catch(() => null)) as { url?: string } | null;
  if (!body || typeof body.url !== "string") {
    throw new LicenseError("server", "License server returned an unexpected response.");
  }
  return body.url;
}
