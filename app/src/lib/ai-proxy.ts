import { BACKEND_BASE_URL } from "@/lib/entitlement-keys";
import { getInstallId, getRawEntitlementToken } from "@/lib/entitlement";

// Hosted, entitlement-gated proxy to Claude. Used for free-tier generation
// (metered by install id) and Pro-without-key generation (metered by the signed
// entitlement, sent as X-Optia-Entitlement). BYO keys never come here — those go
// browser→Anthropic directly (see anthropic.ts).

export type AiProxyErrorCode =
  | "quota_exceeded"
  | "rate_limited"
  | "unauthorized"
  | "invalid"
  | "upstream"
  | "network";

export class AiProxyError extends Error {
  constructor(
    public code: AiProxyErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AiProxyError";
  }
}

export interface ProxyQuota {
  limit: number;
  remaining: number;
  period: string;
}

export interface ProxyResult {
  recommendation: string;
  model: string;
  quota: ProxyQuota;
  /** Whether the entitlement was actually presented (drives which quota the caller records). */
  authenticated: boolean;
}

export interface ProxyRequest {
  checkId: string;
  keyword: string;
  context: string;
  /** When true, authenticate as Pro via the stored entitlement; else free-tier by install id. */
  authenticated: boolean;
}

interface ErrorBody {
  error?: { code?: string; message?: string };
  code?: string;
  message?: string;
}

async function readError(response: Response): Promise<{ code: string; message: string }> {
  try {
    const body = (await response.json()) as ErrorBody;
    return {
      code: body.error?.code ?? body.code ?? "",
      message: body.error?.message ?? body.message ?? "",
    };
  } catch {
    return { code: "", message: "" };
  }
}

function mapError(status: number, code: string, message: string): AiProxyError {
  if (status === 429) {
    if (code === "QUOTA_EXCEEDED") {
      return new AiProxyError("quota_exceeded", message || "AI quota reached.");
    }
    return new AiProxyError("rate_limited", message || "Too many AI requests. Please slow down.");
  }
  if (status === 401) {
    return new AiProxyError("unauthorized", message || "Your Pro entitlement is no longer valid.");
  }
  if (status === 400) {
    return new AiProxyError("invalid", message || "The AI request was rejected.");
  }
  return new AiProxyError("upstream", message || "The AI provider could not complete the request.");
}

/** POSTs one generation to the hosted proxy. Throws AiProxyError on failure. */
export async function generateViaProxy(request: ProxyRequest): Promise<ProxyResult> {
  const { checkId, keyword, context, authenticated } = request;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  // Pro metering requires the token to actually be present; if it isn't, the
  // request is install-metered (free) and the caller records it as such.
  let didAuthenticate = false;
  if (authenticated) {
    const token = await getRawEntitlementToken();
    if (token) {
      headers["X-Optia-Entitlement"] = token;
      didAuthenticate = true;
    }
  }
  const installId = await getInstallId();

  let response: Response;
  try {
    response = await fetch(`${BACKEND_BASE_URL}/ai/generate`, {
      method: "POST",
      headers,
      body: JSON.stringify({ checkId, keyword, context, installId }),
    });
  } catch {
    throw new AiProxyError("network", "Could not reach the AI service.");
  }

  if (!response.ok) {
    const { code, message } = await readError(response);
    throw mapError(response.status, code, message);
  }

  const body = (await response.json().catch(() => null)) as Partial<ProxyResult> | null;
  if (!body || typeof body.recommendation !== "string" || !body.quota) {
    throw new AiProxyError("upstream", "The AI service returned an unexpected response.");
  }
  return {
    recommendation: body.recommendation,
    model: body.model ?? "",
    quota: body.quota,
    authenticated: didAuthenticate,
  };
}
