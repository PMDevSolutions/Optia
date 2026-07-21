// @vitest-environment node
// jose signs/verifies with WebCrypto; under jsdom its Uint8Array realm check
// fails (TextEncoder output crosses realms), so this suite runs in node.
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import {
  activate,
  currentAiPeriod,
  deactivate,
  getFreeAiQuota,
  getInstallId,
  getProAiRemaining,
  getRawEntitlementToken,
  getRefreshFailureCount,
  getValidEntitlement,
  recordFreeAiQuota,
  recordProAiQuota,
  refreshNow,
  verifyEntitlementToken,
  ENTITLEMENT_TOKEN_KEY,
  FREE_AI_QUOTA_KEY,
  INSTALL_ID_KEY,
  LICENSE_KEY_KEY,
  PRO_AI_QUOTA_KEY,
  REFRESH_FAILURES_KEY,
  type EntitlementClaims,
  type QuotaSnapshot,
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

describe("getRawEntitlementToken", () => {
  it("returns null when no token is cached", async () => {
    expect(await getRawEntitlementToken()).toBeNull();
  });

  it("returns the raw stored token verbatim", async () => {
    const token = await signTestToken(keys);
    await setStorageItem(ENTITLEMENT_TOKEN_KEY, token);
    expect(await getRawEntitlementToken()).toBe(token);
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

  it("clears license state on a revoked/unknown license but keeps the free allowance", async () => {
    await setStorageItem(ENTITLEMENT_TOKEN_KEY, await signTestToken(keys));
    await setStorageItem(PRO_AI_QUOTA_KEY, {
      period: TEST_PERIOD,
      remaining: 5,
      limit: 100,
    } satisfies QuotaSnapshot);
    await setStorageItem(FREE_AI_QUOTA_KEY, {
      period: TEST_PERIOD,
      remaining: 2,
      limit: 5,
    } satisfies QuotaSnapshot);
    refreshTokenMock.mockRejectedValue(new LicenseError("invalid", "revoked"));

    expect(await refreshNow(verifyOpts)).toBeNull();
    expect(await getStorageItem(ENTITLEMENT_TOKEN_KEY)).toBeNull();
    expect(await getStorageItem(LICENSE_KEY_KEY)).toBeNull();
    expect(await getStorageItem(PRO_AI_QUOTA_KEY)).toBeNull();
    expect(await getStorageItem(FREE_AI_QUOTA_KEY)).not.toBeNull();
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
    await setStorageItem(PRO_AI_QUOTA_KEY, {
      period: TEST_PERIOD,
      remaining: 5,
      limit: 100,
    } satisfies QuotaSnapshot);
    await setStorageItem(FREE_AI_QUOTA_KEY, {
      period: TEST_PERIOD,
      remaining: 2,
      limit: 5,
    } satisfies QuotaSnapshot);
    deactivateLicenseMock.mockRejectedValue(new LicenseError("network", "offline"));

    await deactivate();

    expect(deactivateLicenseMock).toHaveBeenCalledWith("optia_live_abc", "install-1");
    expect(await getStorageItem(ENTITLEMENT_TOKEN_KEY)).toBeNull();
    expect(await getStorageItem(LICENSE_KEY_KEY)).toBeNull();
    // Pro quota is license-scoped and cleared; the free allowance is
    // install-scoped and survives deactivation.
    expect(await getStorageItem(PRO_AI_QUOTA_KEY)).toBeNull();
    expect(await getStorageItem(FREE_AI_QUOTA_KEY)).not.toBeNull();
  });
});

describe("currentAiPeriod", () => {
  it("formats a date as YYYY-MM", () => {
    expect(currentAiPeriod(new Date("2026-07-15T12:00:00Z"))).toBe("2026-07");
    expect(currentAiPeriod(new Date("2026-01-01T00:00:00Z"))).toBe("2026-01");
  });

  it("defaults to the current month in YYYY-MM form", () => {
    expect(currentAiPeriod()).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe("recordProAiQuota / getProAiRemaining", () => {
  const proClaims: EntitlementClaims = {
    sub: "lic_test_123",
    subjectType: "license",
    tier: "pro",
    quotaLimit: 100,
    period: TEST_PERIOD,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  };

  it("falls back to the token's quotaLimit when nothing has been recorded", async () => {
    expect(await getProAiRemaining(proClaims)).toBe(100);
  });

  it("returns the server-recorded remaining for a matching period", async () => {
    await recordProAiQuota({ period: TEST_PERIOD, remaining: 7, limit: 100 });
    expect(await getStorageItem(PRO_AI_QUOTA_KEY)).toEqual({
      period: TEST_PERIOD,
      remaining: 7,
      limit: 100,
    });
    expect(await getProAiRemaining(proClaims)).toBe(7);
  });

  it("ignores a stale-period snapshot and falls back to the token quotaLimit", async () => {
    await recordProAiQuota({ period: "2026-06", remaining: 7, limit: 100 });
    expect(await getProAiRemaining(proClaims)).toBe(100);
  });

  it("never reports a negative remaining", async () => {
    await recordProAiQuota({ period: TEST_PERIOD, remaining: -5, limit: 100 });
    expect(await getProAiRemaining(proClaims)).toBe(0);
  });
});

describe("recordFreeAiQuota / getFreeAiQuota", () => {
  it("returns null when nothing has been recorded", async () => {
    expect(await getFreeAiQuota()).toBeNull();
  });

  it("returns the snapshot when its period is the current month", async () => {
    const now = new Date("2026-07-15T00:00:00Z");
    const snapshot: QuotaSnapshot = {
      period: currentAiPeriod(now),
      remaining: 3,
      limit: 5,
    };
    await recordFreeAiQuota(snapshot);
    expect(await getFreeAiQuota(now)).toEqual(snapshot);
  });

  it("returns null for a stale-month snapshot", async () => {
    await recordFreeAiQuota({ period: "2026-07", remaining: 3, limit: 5 });
    expect(await getFreeAiQuota(new Date("2026-08-15T00:00:00Z"))).toBeNull();
  });
});
