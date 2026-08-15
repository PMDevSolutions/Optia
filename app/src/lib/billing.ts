import { BACKEND_BASE_URL } from "@/lib/entitlement-keys";

// Client for the /billing endpoints. Checkout is capability-based: the session
// id returned by /checkout plus this install's id authorize the later claim of
// the minted license key. The claim is single-use — after a successful claim
// the server answers "gone".

export type BillingErrorCode = "invalid" | "rate_limited" | "server" | "network" | "forbidden";

export class BillingError extends Error {
  constructor(
    public code: BillingErrorCode,
    message: string,
    public retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "BillingError";
  }
}

export interface CheckoutSession {
  url: string;
  sessionId: string;
}

export type SessionStatus =
  | { status: "ready"; licenseKey: string }
  | { status: "pending" }
  | { status: "gone" };

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

async function billingFetch(path: string, init?: Parameters<typeof fetch>[1]): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${BACKEND_BASE_URL}${path}`, init);
  } catch {
    throw new BillingError("network", "Could not reach the billing server.");
  }
  if (response.ok) return response;

  const message = await extractErrorMessage(response);
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("Retry-After"));
    throw new BillingError(
      "rate_limited",
      message ?? "Too many billing requests. Please try again shortly.",
      Number.isFinite(retryAfter) ? retryAfter : undefined,
    );
  }
  if (response.status === 403) {
    throw new BillingError("forbidden", message ?? "This checkout session belongs to another install.");
  }
  if (response.status >= 500) {
    throw new BillingError("server", message ?? "Billing server error.");
  }
  throw new BillingError("invalid", message ?? "The billing request was not valid.");
}

async function postBilling(path: string, body: unknown): Promise<Response> {
  return billingFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Creates a Stripe Checkout session; the returned URL is opened in a new tab. */
export async function createCheckoutSession(
  priceId: string,
  installId: string,
  email?: string,
): Promise<CheckoutSession> {
  const response = await postBilling("/billing/checkout", {
    priceId,
    installId,
    ...(email ? { email } : {}),
  });
  const body = (await response.json().catch(() => null)) as Partial<CheckoutSession> | null;
  if (!body || typeof body.url !== "string" || typeof body.sessionId !== "string") {
    throw new BillingError("server", "Billing server returned an unexpected response.");
  }
  return { url: body.url, sessionId: body.sessionId };
}

/**
 * Polls the post-payment claim for a checkout session. "pending" until the
 * Stripe webhook mints the key; "ready" delivers it exactly once; "gone" after
 * a claim or expiry.
 */
export async function getCheckoutSessionStatus(
  sessionId: string,
  installId: string,
): Promise<SessionStatus> {
  const response = await billingFetch(
    `/billing/session/${encodeURIComponent(sessionId)}?installId=${encodeURIComponent(installId)}`,
  );
  const body = (await response.json().catch(() => null)) as
    | { status?: string; licenseKey?: string }
    | null;
  if (body?.status === "ready" && typeof body.licenseKey === "string") {
    return { status: "ready", licenseKey: body.licenseKey };
  }
  if (body?.status === "pending") return { status: "pending" };
  if (body?.status === "gone") return { status: "gone" };
  throw new BillingError("server", "Billing server returned an unexpected response.");
}

/** Returns a Stripe customer portal URL for managing or cancelling the plan. */
export async function createPortalSession(licenseKey: string): Promise<{ url: string }> {
  const response = await postBilling("/billing/portal", { licenseKey });
  const body = (await response.json().catch(() => null)) as { url?: string } | null;
  if (!body || typeof body.url !== "string") {
    throw new BillingError("server", "Billing server returned an unexpected response.");
  }
  return { url: body.url };
}
