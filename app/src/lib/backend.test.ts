import { describe, it, expect, vi, afterEach } from "vitest";
import {
  activateLicense,
  refreshEntitlementToken,
  deactivateLicense,
  LicenseError,
} from "@/lib/backend";
import { BACKEND_BASE_URL } from "@/lib/entitlement-keys";

function jsonResponse(status: number, body: unknown, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

async function expectLicenseError(
  promise: Promise<unknown>,
  code: LicenseError["code"],
): Promise<LicenseError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(LicenseError);
  expect((error as LicenseError).code).toBe(code);
  return error as LicenseError;
}

describe("backend license client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("activates and returns the raw entitlement token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { entitlement: "a.b.c", tier: "pro" }));
    vi.stubGlobal("fetch", fetchMock);

    const token = await activateLicense("optia_live_key", "install-1");

    expect(token).toBe("a.b.c");
    expect(fetchMock).toHaveBeenCalledWith(`${BACKEND_BASE_URL}/license/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey: "optia_live_key", installId: "install-1" }),
    });
  });

  it("refreshes via /license/refresh", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { entitlement: "x.y.z" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(refreshEntitlementToken("key", "install-1")).resolves.toBe("x.y.z");
    expect(fetchMock).toHaveBeenCalledWith(
      `${BACKEND_BASE_URL}/license/refresh`,
      expect.anything(),
    );
  });

  it("maps 403/404 to an invalid-license error with the server message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(403, { error: { message: "License is not active." } })),
    );
    const error = await expectLicenseError(activateLicense("key", "install-1"), "invalid");
    expect(error.message).toBe("License is not active.");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, {})));
    await expectLicenseError(refreshEntitlementToken("key", "install-1"), "invalid");
  });

  it("maps 429 to rate_limited and parses Retry-After", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(429, {}, { "Retry-After": "42" })),
    );
    const error = await expectLicenseError(activateLicense("key", "install-1"), "rate_limited");
    expect(error.retryAfterSeconds).toBe(42);
  });

  it("maps 5xx to a server error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, {})));
    await expectLicenseError(refreshEntitlementToken("key", "install-1"), "server");
  });

  it("maps a fetch failure to a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expectLicenseError(activateLicense("key", "install-1"), "network");
  });

  it("rejects a 200 response without an entitlement field", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { ok: true })));
    await expectLicenseError(activateLicense("key", "install-1"), "server");
  });

  it("deactivates without returning a token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(deactivateLicense("key", "install-1")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      `${BACKEND_BASE_URL}/license/deactivate`,
      expect.anything(),
    );
  });
});
