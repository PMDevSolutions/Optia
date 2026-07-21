import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateViaProxy, AiProxyError, type ProxyRequest } from "@/lib/ai-proxy";
import { BACKEND_BASE_URL } from "@/lib/entitlement-keys";
import { getInstallId, getRawEntitlementToken } from "@/lib/entitlement";

// Mock only the two entitlement helpers ai-proxy depends on, so this suite drives
// the proxy request/response mapping without touching jose or storage.
vi.mock("@/lib/entitlement", () => ({
  getInstallId: vi.fn(),
  getRawEntitlementToken: vi.fn(),
}));

const getInstallIdMock = vi.mocked(getInstallId);
const getRawEntitlementTokenMock = vi.mocked(getRawEntitlementToken);

const GENERATE_URL = `${BACKEND_BASE_URL}/ai/generate`;

function jsonResponse(status: number, body: unknown, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/** A 200 whose body is not valid JSON, exercising the `.json()` failure path. */
function nonJsonResponse(status: number) {
  return new Response("<<not json>>", {
    status,
    headers: { "Content-Type": "text/html" },
  });
}

function request(overrides: Partial<ProxyRequest> = {}): ProxyRequest {
  return {
    checkId: "check-1",
    keyword: "seo keyword",
    context: "the surrounding context",
    authenticated: true,
    ...overrides,
  };
}

async function expectProxyError(
  promise: Promise<unknown>,
  code: AiProxyError["code"],
): Promise<AiProxyError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(AiProxyError);
  expect((error as AiProxyError).code).toBe(code);
  return error as AiProxyError;
}

const OK_BODY = {
  recommendation: "Add the keyword to the H1.",
  model: "claude-x",
  quota: { limit: 100, remaining: 99, period: "2026-07" },
};

beforeEach(() => {
  getInstallIdMock.mockResolvedValue("install-xyz");
  getRawEntitlementTokenMock.mockResolvedValue("tok-123");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("generateViaProxy request shape", () => {
  it("POSTs to /ai/generate with the check payload and the resolved install id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, OK_BODY));
    vi.stubGlobal("fetch", fetchMock);

    await generateViaProxy(
      request({ checkId: "c9", keyword: "kw", context: "ctx", authenticated: true }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(GENERATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Optia-Entitlement": "tok-123" },
      body: JSON.stringify({
        checkId: "c9",
        keyword: "kw",
        context: "ctx",
        installId: "install-xyz",
      }),
    });
  });

  it("attaches X-Optia-Entitlement when authenticated and a token is available", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, OK_BODY));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateViaProxy(request({ authenticated: true }));

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>)["X-Optia-Entitlement"]).toBe("tok-123");
    // The subject actually metered was the entitlement (Pro).
    expect(result.authenticated).toBe(true);
  });

  it("reports authenticated:false when authenticated but no token is stored (install-metered)", async () => {
    getRawEntitlementTokenMock.mockResolvedValue(null);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, OK_BODY));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateViaProxy(request({ authenticated: true }));

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(getRawEntitlementTokenMock).toHaveBeenCalledTimes(1);
    // A Pro request whose token is missing was metered as free, and says so.
    expect(result.authenticated).toBe(false);
  });

  it("omits X-Optia-Entitlement and never reads the token when not authenticated", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, OK_BODY));
    vi.stubGlobal("fetch", fetchMock);

    await generateViaProxy(request({ authenticated: false }));

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(getRawEntitlementTokenMock).not.toHaveBeenCalled();
  });
});

describe("generateViaProxy success", () => {
  it("returns the recommendation, model, and quota from a 200 body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, OK_BODY)));

    const result = await generateViaProxy(request());

    expect(result).toMatchObject(OK_BODY);
    expect(result.quota).toEqual({ limit: 100, remaining: 99, period: "2026-07" });
  });
});

describe("generateViaProxy error mapping", () => {
  it("maps a 429 with a QUOTA_EXCEEDED code (nested error body) to quota_exceeded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(429, { error: { code: "QUOTA_EXCEEDED", message: "You are out of AI credits." } }),
      ),
    );

    const error = await expectProxyError(generateViaProxy(request()), "quota_exceeded");
    expect(error.message).toBe("You are out of AI credits.");
  });

  it("maps a 429 with a QUOTA_EXCEEDED code (bare code/message body) to quota_exceeded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(429, { code: "QUOTA_EXCEEDED", message: "Monthly limit hit." }),
      ),
    );

    const error = await expectProxyError(generateViaProxy(request()), "quota_exceeded");
    expect(error.message).toBe("Monthly limit hit.");
  });

  it("maps a 429 without a quota code to rate_limited", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(429, { error: { code: "TOO_FAST" } })),
    );

    await expectProxyError(generateViaProxy(request()), "rate_limited");
  });

  it("maps a 401 to unauthorized", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: "Entitlement expired." } })),
    );

    const error = await expectProxyError(generateViaProxy(request()), "unauthorized");
    expect(error.message).toBe("Entitlement expired.");
  });

  it("maps a 400 to invalid using a bare message body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(400, { code: "BAD_INPUT", message: "Keyword required." })),
    );

    const error = await expectProxyError(generateViaProxy(request()), "invalid");
    expect(error.message).toBe("Keyword required.");
  });

  it("maps any other non-ok status to upstream", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, {})));

    const error = await expectProxyError(generateViaProxy(request()), "upstream");
    expect(error.message).toBe("The AI provider could not complete the request.");
  });

  it("falls back to a default message when the error body is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(nonJsonResponse(503)));

    const error = await expectProxyError(generateViaProxy(request()), "upstream");
    expect(error.message).toBe("The AI provider could not complete the request.");
  });

  it("maps a fetch rejection to a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const error = await expectProxyError(generateViaProxy(request()), "network");
    expect(error.message).toBe("Could not reach the AI service.");
  });
});

describe("generateViaProxy malformed success bodies", () => {
  it("treats a 200 missing recommendation as upstream", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, { model: "claude-x", quota: OK_BODY.quota }),
      ),
    );

    await expectProxyError(generateViaProxy(request()), "upstream");
  });

  it("treats a 200 whose recommendation is not a string as upstream", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, { recommendation: 42, model: "claude-x", quota: OK_BODY.quota }),
      ),
    );

    await expectProxyError(generateViaProxy(request()), "upstream");
  });

  it("treats a 200 missing quota as upstream", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, { recommendation: "ok", model: "claude-x" }),
      ),
    );

    const error = await expectProxyError(generateViaProxy(request()), "upstream");
    expect(error.message).toBe("The AI service returned an unexpected response.");
  });

  it("treats a 200 with an unparseable body as upstream", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(nonJsonResponse(200)));

    await expectProxyError(generateViaProxy(request()), "upstream");
  });
});
