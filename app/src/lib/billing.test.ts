import { describe, it, expect, vi, afterEach } from "vitest";
import {
  BillingError,
  createCheckoutSession,
  createPortalSession,
  getCheckoutSessionStatus,
} from "@/lib/billing";
import { BACKEND_BASE_URL } from "@/lib/entitlement-keys";

function jsonResponse(status: number, body: unknown, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

async function expectBillingError(
  promise: Promise<unknown>,
  code: BillingError["code"],
): Promise<BillingError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(BillingError);
  expect((error as BillingError).code).toBe(code);
  return error as BillingError;
}

describe("billing client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates a checkout session and returns url + sessionId", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { url: "https://checkout.stripe.com/x", sessionId: "cs_1" }));
    vi.stubGlobal("fetch", fetchMock);

    const session = await createCheckoutSession("price_123", "install-1");

    expect(session).toEqual({ url: "https://checkout.stripe.com/x", sessionId: "cs_1" });
    expect(fetchMock).toHaveBeenCalledWith(`${BACKEND_BASE_URL}/billing/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId: "price_123", installId: "install-1" }),
    });
  });

  it("rejects a checkout response without a url", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { sessionId: "cs_1" })));
    await expectBillingError(createCheckoutSession("price_123", "install-1"), "server");
  });

  it("polls the session claim endpoint with the install id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { status: "pending" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getCheckoutSessionStatus("cs_1", "install-1")).resolves.toEqual({
      status: "pending",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `${BACKEND_BASE_URL}/billing/session/cs_1?installId=install-1`,
      undefined,
    );
  });

  it("returns the license key when the claim is ready", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { status: "ready", licenseKey: "optia_key" })),
    );
    await expect(getCheckoutSessionStatus("cs_1", "install-1")).resolves.toEqual({
      status: "ready",
      licenseKey: "optia_key",
    });
  });

  it("reports a claimed or expired session as gone", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { status: "gone" })));
    await expect(getCheckoutSessionStatus("cs_1", "install-1")).resolves.toEqual({
      status: "gone",
    });
  });

  it("maps 403 to a forbidden error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(403, { error: { message: "Install mismatch." } })),
    );
    const error = await expectBillingError(getCheckoutSessionStatus("cs_1", "other"), "forbidden");
    expect(error.message).toBe("Install mismatch.");
  });

  it("maps 429 to rate_limited and parses Retry-After", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(429, {}, { "Retry-After": "30" })),
    );
    const error = await expectBillingError(
      createCheckoutSession("price_123", "install-1"),
      "rate_limited",
    );
    expect(error.retryAfterSeconds).toBe(30);
  });

  it("maps 5xx to a server error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, {})));
    await expectBillingError(getCheckoutSessionStatus("cs_1", "install-1"), "server");
  });

  it("maps a fetch failure to a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expectBillingError(createCheckoutSession("price_123", "install-1"), "network");
  });

  it("returns the customer portal url", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { url: "https://billing.stripe.com/p" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createPortalSession("optia_key")).resolves.toEqual({
      url: "https://billing.stripe.com/p",
    });
    expect(fetchMock).toHaveBeenCalledWith(`${BACKEND_BASE_URL}/billing/portal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey: "optia_key" }),
    });
  });
});
