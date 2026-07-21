// @vitest-environment node
// jose signs/verifies with WebCrypto; under jsdom its Uint8Array realm check
// fails (TextEncoder output crosses realms), so this suite runs in node.
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import {
  activate,
  consumeAiQuota,
  deactivate,
  getAiQuotaRemaining,
  getInstallId,
  getRefreshFailureCount,
  getValidEntitlement,
  refreshNow,
  verifyEntitlementToken,
  AI_USAGE_KEY,
  ENTITLEMENT_TOKEN_KEY,
  INSTALL_ID_KEY,
  LICENSE_KEY_KEY,
  REFRESH_FAILURES_KEY,
} from "@/lib/entitlement";
import { getStorageItem, setStorageItem } from "@/lib/storage";
import {
  createTestKeys,
  hs256Token,
  signTestToken,
  tamperWithToken,
  unsignedToken,
  TEST_PERIOD,
  type TestSigningKeys,
} from "@/test/entitlement-fixtures";
import {
  activateLicense,
  deactivateLicense,
  refreshEntitlementToken,
  LicenseError,
} from "@/lib/backend";

vi.mock("@/lib/backend", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/backend")>();
  return {
    ...original,
    activateLicense: vi.fn(),
    refreshEntitlementToken: vi.fn(),
    deactivateLicense: vi.fn(),
  };
});

const activateLicenseMock = vi.mocked(activateLicense);
const refreshTokenMock = vi.mocked(refreshEntitlementToken);
const deactivateLicenseMock = vi.mocked(deactivateLicense);

let keys: TestSigningKeys;
let verifyOpts: { jwks: [typeof keys.jwk] };

beforeAll(async () => {
  keys = await createTestKeys();
  verifyOpts = { jwks: [keys.jwk] };
});

describe("verifyEntitlementToken", () => {
  it("returns the claims of a valid token", async () => {
    const token = await signTestToken(keys);
    const claims = await verifyEntitlementToken(token, verifyOpts);
    expect(claims).toMatchObject({
      sub: "lic_test_123",
      subjectType: "license",
      tier: "pro",
      quotaLimit: 100,
      period: TEST_PERIOD,
    });
  });

  it("rejects an expired token", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signTestToken(keys, { exp: now - 7200, iat: now - 10800 });
    expect(await verifyEntitlementToken(token, verifyOpts)).toBeNull();
  });

  it("accepts a token expired within the clock-skew tolerance", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signTestToken(keys, { exp: now - 30 });
    expect(await verifyEntitlementToken(token, verifyOpts)).not.toBeNull();
  });

  it("rejects a tampered payload", async () => {
    const token = tamperWithToken(await signTestToken(keys));
    expect(await verifyEntitlementToken(token, verifyOpts)).toBeNull();
  });

  it("rejects alg=none", async () => {
    expect(await verifyEntitlementToken(unsignedToken(), verifyOpts)).toBeNull();
  });

  it("rejects an HS256 token even with a trusted kid", async () => {
    expect(await verifyEntitlementToken(await hs256Token(), verifyOpts)).toBeNull();
  });

  it("rejects wrong issuer or audience", async () => {
    expect(
      await verifyEntitlementToken(await signTestToken(keys, { iss: "evil" }), verifyOpts),
    ).toBeNull();
    expect(
      await verifyEntitlementToken(await signTestToken(keys, { aud: "other-app" }), verifyOpts),
    ).toBeNull();
  });

  it("rejects an unknown kid", async () => {
    const otherKeys = await createTestKeys("other-kid");
    const token = await signTestToken(otherKeys);
    expect(await verifyEntitlementToken(token, verifyOpts)).toBeNull();
  });

  it("rejects tokens with malformed claims", async () => {
    const token = await signTestToken(keys, {
      quotaLimit: "lots" as unknown as number,
    });
    expect(await verifyEntitlementToken(token, verifyOpts)).toBeNull();
    expect(await verifyEntitlementToken("not-a-jwt", verifyOpts)).toBeNull();
  });
});

describe("getValidEntitlement", () => {
  it("returns null when nothing is cached", async () => {
    expect(await getValidEntitlement(verifyOpts)).toBeNull();
  });

  it("round-trips a cached valid token", async () => {
    await setStorageItem(ENTITLEMENT_TOKEN_KEY, await signTestToken(keys));
    const claims = await getValidEntitlement(verifyOpts);
    expect(claims?.tier).toBe("pro");
  });

  it("returns null for a cached expired token", async () => {
    const now = Math.floor(Date.now() / 1000);
    await setStorageItem(ENTITLEMENT_TOKEN_KEY, await signTestToken(keys, { exp: now - 7200 }));
    expect(await getValidEntitlement(verifyOpts)).toBeNull();
  });
});

describe("getInstallId", () => {
  it("generates once and then returns the same id", async () => {
    const first = await getInstallId();
    expect(first).toMatch(/[0-9a-f-]{36}/);
    expect(await getInstallId()).toBe(first);
    expect(await getStorageItem(INSTALL_ID_KEY)).toBe(first);
  });
});

describe("activate", () => {
  it("persists a verified token and the license key", async () => {
    const token = await signTestToken(keys);
    activateLicenseMock.mockResolvedValue(token);

    const claims = await activate("optia_live_abc", verifyOpts);

    expect(claims.tier).toBe("pro");
    expect(await getStorageItem(ENTITLEMENT_TOKEN_KEY)).toBe(token);
    expect(await getStorageItem(LICENSE_KEY_KEY)).toBe("optia_live_abc");
    expect(activateLicenseMock).toHaveBeenCalledWith(
      "optia_live_abc",
      await getStorageItem(INSTALL_ID_KEY),
    );
  });

  it("does not persist anything when the returned token fails verification", async () => {
    activateLicenseMock.mockResolvedValue(tamperWithToken(await signTestToken(keys)));

    await expect(activate("optia_live_abc", verifyOpts)).rejects.toBeInstanceOf(LicenseError);
    expect(await getStorageItem(ENTITLEMENT_TOKEN_KEY)).toBeNull();
    expect(await getStorageItem(LICENSE_KEY_KEY)).toBeNull();
  });
});

describe("refreshNow", () => {
  beforeEach(async () => {
    await setStorageItem(LICENSE_KEY_KEY, "optia_live_abc");
    await setStorageItem(INSTALL_ID_KEY, "install-1");
  });

  it("persists a fresh verified token and resets the failure counter", async () => {
    await setStorageItem(REFRESH_FAILURES_KEY, 3);
    const token = await signTestToken(keys);
    refreshTokenMock.mockResolvedValue(token);

    const claims = await refreshNow(verifyOpts);

    expect(claims?.tier).toBe("pro");
    expect(await getStorageItem(ENTITLEMENT_TOKEN_KEY)).toBe(token);
    expect(await getRefreshFailureCount()).toBe(0);
    expect(refreshTokenMock).toHaveBeenCalledWith("optia_live_abc", "install-1");
  });

  it("keeps the last valid token when the refresh fails offline", async () => {
    const cached = await signTestToken(keys);
    await setStorageItem(ENTITLEMENT_TOKEN_KEY, cached);
    refreshTokenMock.mockRejectedValue(new LicenseError("network", "offline"));

    const claims = await refreshNow(verifyOpts);

    expect(claims?.tier).toBe("pro");
    expect(await getStorageItem(ENTITLEMENT_TOKEN_KEY)).toBe(cached);
    expect(await getRefreshFailureCount()).toBe(1);
  });

  it("returns null offline once the cached token has expired", async () => {
    const now = Math.floor(Date.now() / 1000);
    await setStorageItem(ENTITLEMENT_TOKEN_KEY, await signTestToken(keys, { exp: now - 7200 }));
    refreshTokenMock.mockRejectedValue(new LicenseError("network", "offline"));

    expect(await refreshNow(verifyOpts)).toBeNull();
  });

  it("clears all license state when the license is revoked or unknown", async () => {
    await setStorageItem(ENTITLEMENT_TOKEN_KEY, await signTestToken(keys));
    refreshTokenMock.mockRejectedValue(new LicenseError("invalid", "revoked"));

    expect(await refreshNow(verifyOpts)).toBeNull();
    expect(await getStorageItem(ENTITLEMENT_TOKEN_KEY)).toBeNull();
    expect(await getStorageItem(LICENSE_KEY_KEY)).toBeNull();
  });

  it("does not persist a tampered refresh response", async () => {
    const cached = await signTestToken(keys);
    await setStorageItem(ENTITLEMENT_TOKEN_KEY, cached);
    refreshTokenMock.mockResolvedValue(tamperWithToken(await signTestToken(keys)));

    const claims = await refreshNow(verifyOpts);

    expect(claims?.tier).toBe("pro");
    expect(await getStorageItem(ENTITLEMENT_TOKEN_KEY)).toBe(cached);
    expect(await getRefreshFailureCount()).toBe(1);
  });
});

describe("deactivate", () => {
  it("releases the seat and clears local state even if the backend call fails", async () => {
    await setStorageItem(LICENSE_KEY_KEY, "optia_live_abc");
    await setStorageItem(INSTALL_ID_KEY, "install-1");
    await setStorageItem(ENTITLEMENT_TOKEN_KEY, await signTestToken(keys));
    await setStorageItem(AI_USAGE_KEY, { period: TEST_PERIOD, used: 5 });
    deactivateLicenseMock.mockRejectedValue(new LicenseError("network", "offline"));

    await deactivate();

    expect(deactivateLicenseMock).toHaveBeenCalledWith("optia_live_abc", "install-1");
    expect(await getStorageItem(ENTITLEMENT_TOKEN_KEY)).toBeNull();
    expect(await getStorageItem(LICENSE_KEY_KEY)).toBeNull();
    expect(await getStorageItem(AI_USAGE_KEY)).toBeNull();
  });
});

describe("AI quota", () => {
  beforeEach(async () => {
    await setStorageItem(ENTITLEMENT_TOKEN_KEY, await signTestToken(keys, { quotaLimit: 3 }));
  });

  it("computes remaining from the stored usage for the same period", async () => {
    const claims = await getValidEntitlement(verifyOpts);
    await setStorageItem(AI_USAGE_KEY, { period: TEST_PERIOD, used: 2 });
    expect(await getAiQuotaRemaining(claims!)).toBe(1);
  });

  it("consumes down to zero and never goes negative", async () => {
    expect(await consumeAiQuota(verifyOpts)).toBe(2);
    expect(await consumeAiQuota(verifyOpts)).toBe(1);
    expect(await consumeAiQuota(verifyOpts)).toBe(0);
    expect(await consumeAiQuota(verifyOpts)).toBe(0);
  });

  it("resets the counter when the token period rolls over", async () => {
    await setStorageItem(AI_USAGE_KEY, { period: "2026-06", used: 3 });
    const claims = await getValidEntitlement(verifyOpts);
    expect(await getAiQuotaRemaining(claims!)).toBe(3);
    expect(await consumeAiQuota(verifyOpts)).toBe(2);
    expect(await getStorageItem(AI_USAGE_KEY)).toEqual({ period: TEST_PERIOD, used: 1 });
  });

  it("consumes nothing without a valid entitlement", async () => {
    await setStorageItem(ENTITLEMENT_TOKEN_KEY, "garbage");
    expect(await consumeAiQuota(verifyOpts)).toBe(0);
    expect(await getStorageItem(AI_USAGE_KEY)).toBeNull();
  });
});
