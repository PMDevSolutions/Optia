import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  useEntitlementStore,
  useAiStatus,
  useCanUseAI,
  aiStatusNow,
  initEntitlementSync,
} from "@/lib/entitlement-store";
import { useStore } from "@/lib/store";
import {
  getValidEntitlement,
  getFreeAiQuota,
  getProAiRemaining,
  hasStoredLicenseKey,
  activate,
  deactivate,
  recordProAiQuota,
  recordFreeAiQuota,
  ENTITLEMENT_TOKEN_KEY,
  LICENSE_KEY_KEY,
  PRO_AI_QUOTA_KEY,
  FREE_AI_QUOTA_KEY,
  type EntitlementClaims,
  type QuotaSnapshot,
} from "@/lib/entitlement";
import { LicenseError } from "@/lib/backend";

// The store owns the feature flags; the entitlement layer underneath is mocked
// so these tests drive the flag/quota logic without jose, storage, or network.
// Constants (the watched storage keys) stay real via importOriginal.
vi.mock("@/lib/entitlement", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/entitlement")>();
  return {
    ...original,
    getValidEntitlement: vi.fn(),
    getFreeAiQuota: vi.fn(),
    getProAiRemaining: vi.fn(),
    hasStoredLicenseKey: vi.fn(),
    activate: vi.fn(),
    deactivate: vi.fn(),
    recordProAiQuota: vi.fn(),
    recordFreeAiQuota: vi.fn(),
  };
});

const getValidEntitlementMock = vi.mocked(getValidEntitlement);
const getFreeAiQuotaMock = vi.mocked(getFreeAiQuota);
const getProAiRemainingMock = vi.mocked(getProAiRemaining);
const hasStoredLicenseKeyMock = vi.mocked(hasStoredLicenseKey);
const activateMock = vi.mocked(activate);
const deactivateMock = vi.mocked(deactivate);
const recordProAiQuotaMock = vi.mocked(recordProAiQuota);
const recordFreeAiQuotaMock = vi.mocked(recordFreeAiQuota);

const proClaims: EntitlementClaims = {
  sub: "lic_1",
  subjectType: "license",
  tier: "pro",
  quotaLimit: 100,
  period: "2026-07",
  exp: Math.floor(Date.now() / 1000) + 3600,
  iat: Math.floor(Date.now() / 1000),
};

const freeSnapshot: QuotaSnapshot = { period: "2026-07", remaining: 4, limit: 10 };

// Full free/default shape — resets every store field so no test leaks state.
function resetEntitlementState() {
  useEntitlementStore.setState({
    entitlementLoaded: false,
    isPro: false,
    tier: "free",
    expiresAt: null,
    quotaLimit: 0,
    aiQuotaRemaining: 0,
    freeAiRemaining: null,
    freeAiLimit: null,
    canUseAdvancedOptions: false,
    canUseMultiLanguage: false,
    canUseSchema: false,
    canBringOwnKey: false,
    hasLicenseKey: false,
    activating: false,
    activationError: null,
  });
}

beforeEach(() => {
  resetEntitlementState();
  useStore.setState({ apiKey: "" });
  hasStoredLicenseKeyMock.mockResolvedValue(false);
  getValidEntitlementMock.mockResolvedValue(null);
  getFreeAiQuotaMock.mockResolvedValue(null);
  getProAiRemainingMock.mockResolvedValue(0);
});

describe("hydrateEntitlement", () => {
  it("maps a valid Pro entitlement to all Pro flags", async () => {
    getValidEntitlementMock.mockResolvedValue(proClaims);
    getProAiRemainingMock.mockResolvedValue(42);
    hasStoredLicenseKeyMock.mockResolvedValue(true);
    getFreeAiQuotaMock.mockResolvedValue(freeSnapshot);

    await useEntitlementStore.getState().hydrateEntitlement();

    const state = useEntitlementStore.getState();
    expect(state.entitlementLoaded).toBe(true);
    expect(state.isPro).toBe(true);
    expect(state.tier).toBe("pro");
    expect(state.expiresAt).toBe(proClaims.exp * 1000);
    expect(state.quotaLimit).toBe(100);
    expect(state.aiQuotaRemaining).toBe(42);
    expect(state.hasLicenseKey).toBe(true);
    expect(state.canUseAdvancedOptions).toBe(true);
    expect(state.canUseMultiLanguage).toBe(true);
    expect(state.canUseSchema).toBe(true);
    expect(state.canBringOwnKey).toBe(true);
    // Free-quota snapshot is populated even on the Pro branch.
    expect(state.freeAiRemaining).toBe(4);
    expect(state.freeAiLimit).toBe(10);
  });

  it("reads the Pro remaining quota from getProAiRemaining(claims)", async () => {
    getValidEntitlementMock.mockResolvedValue(proClaims);
    getProAiRemainingMock.mockResolvedValue(7);

    await useEntitlementStore.getState().hydrateEntitlement();

    expect(getProAiRemainingMock).toHaveBeenCalledWith(proClaims);
    expect(useEntitlementStore.getState().aiQuotaRemaining).toBe(7);
  });

  it("resolves a missing or expired entitlement to free defaults", async () => {
    getValidEntitlementMock.mockResolvedValue(null);
    hasStoredLicenseKeyMock.mockResolvedValue(true);

    await useEntitlementStore.getState().hydrateEntitlement();

    const state = useEntitlementStore.getState();
    expect(state.entitlementLoaded).toBe(true);
    expect(state.isPro).toBe(false);
    expect(state.tier).toBe("free");
    expect(state.expiresAt).toBeNull();
    expect(state.quotaLimit).toBe(0);
    expect(state.aiQuotaRemaining).toBe(0);
    expect(state.canUseAdvancedOptions).toBe(false);
    expect(state.canUseMultiLanguage).toBe(false);
    expect(state.canUseSchema).toBe(false);
    expect(state.canBringOwnKey).toBe(false);
    // hasLicenseKey is independent of tier (a stored key with no valid token).
    expect(state.hasLicenseKey).toBe(true);
  });

  it("never grants Pro for a non-'pro' tier claim", async () => {
    getValidEntitlementMock.mockResolvedValue({ ...proClaims, tier: "trial" });

    await useEntitlementStore.getState().hydrateEntitlement();

    const state = useEntitlementStore.getState();
    expect(state.isPro).toBe(false);
    expect(state.canUseAdvancedOptions).toBe(false);
    expect(state.canBringOwnKey).toBe(false);
  });

  it("populates free quota from a snapshot on the free tier", async () => {
    getValidEntitlementMock.mockResolvedValue(null);
    getFreeAiQuotaMock.mockResolvedValue({ period: "2026-07", remaining: 3, limit: 5 });

    await useEntitlementStore.getState().hydrateEntitlement();

    const state = useEntitlementStore.getState();
    expect(state.freeAiRemaining).toBe(3);
    expect(state.freeAiLimit).toBe(5);
  });

  it("leaves free quota null when no snapshot exists this period", async () => {
    getValidEntitlementMock.mockResolvedValue(null);
    getFreeAiQuotaMock.mockResolvedValue(null);

    await useEntitlementStore.getState().hydrateEntitlement();

    const state = useEntitlementStore.getState();
    expect(state.freeAiRemaining).toBeNull();
    expect(state.freeAiLimit).toBeNull();
  });
});

describe("aiStatusNow (computeAiStatus truth table)", () => {
  it("Pro + own key → byok, unlimited", () => {
    useStore.setState({ apiKey: "sk-own" });
    useEntitlementStore.setState({ isPro: true, aiQuotaRemaining: 0, quotaLimit: 100 });

    expect(aiStatusNow()).toEqual({ mode: "byok", remaining: null, limit: null });
  });

  it("Pro + no key + quota remaining → pro (metered)", () => {
    useEntitlementStore.setState({ isPro: true, aiQuotaRemaining: 5, quotaLimit: 100 });

    expect(aiStatusNow()).toEqual({ mode: "pro", remaining: 5, limit: 100 });
  });

  it("Pro + no key + quota exhausted → locked", () => {
    useEntitlementStore.setState({ isPro: true, aiQuotaRemaining: 0, quotaLimit: 100 });

    expect(aiStatusNow()).toEqual({ mode: "locked", remaining: 0, limit: 100 });
  });

  it("free + own key → free (a stray key never grants byok)", () => {
    useStore.setState({ apiKey: "sk-stray" });
    useEntitlementStore.setState({ isPro: false, freeAiRemaining: 3, freeAiLimit: 10 });

    expect(aiStatusNow()).toEqual({ mode: "free", remaining: 3, limit: 10 });
  });

  it("free + unknown remaining (null) → free (unknown is available)", () => {
    useEntitlementStore.setState({ isPro: false, freeAiRemaining: null, freeAiLimit: null });

    expect(aiStatusNow()).toEqual({ mode: "free", remaining: null, limit: null });
  });

  it("free + remaining > 0 → free", () => {
    useEntitlementStore.setState({ isPro: false, freeAiRemaining: 2, freeAiLimit: 5 });

    expect(aiStatusNow()).toEqual({ mode: "free", remaining: 2, limit: 5 });
  });

  it("free + remaining 0 → locked", () => {
    useEntitlementStore.setState({ isPro: false, freeAiRemaining: 0, freeAiLimit: 5 });

    expect(aiStatusNow()).toEqual({ mode: "locked", remaining: 0, limit: 5 });
  });
});

describe("useAiStatus / useCanUseAI (reactive hooks)", () => {
  it("useAiStatus mirrors the computed status", () => {
    useStore.setState({ apiKey: "sk-own" });
    useEntitlementStore.setState({ isPro: true });

    const { result } = renderHook(() => useAiStatus());
    expect(result.current).toEqual({ mode: "byok", remaining: null, limit: null });
  });

  it("useCanUseAI is true while AI is available", () => {
    useEntitlementStore.setState({ isPro: true, aiQuotaRemaining: 5, quotaLimit: 100 });

    const { result } = renderHook(() => useCanUseAI());
    expect(result.current).toBe(true);
  });

  it("useCanUseAI is false when the mode is locked", () => {
    useEntitlementStore.setState({ isPro: false, freeAiRemaining: 0, freeAiLimit: 5 });

    const { result } = renderHook(() => useCanUseAI());
    expect(result.current).toBe(false);
  });
});

describe("applyProxyQuota", () => {
  it("records and reflects a Pro quota snapshot", async () => {
    const quota: QuotaSnapshot = { period: "2026-07", remaining: 7, limit: 100 };

    await useEntitlementStore.getState().applyProxyQuota(quota, "pro");

    expect(recordProAiQuotaMock).toHaveBeenCalledWith(quota);
    expect(recordFreeAiQuotaMock).not.toHaveBeenCalled();
    const state = useEntitlementStore.getState();
    expect(state.aiQuotaRemaining).toBe(7);
    expect(state.quotaLimit).toBe(100);
    // The free fields are untouched by a Pro-metered call.
    expect(state.freeAiRemaining).toBeNull();
    expect(state.freeAiLimit).toBeNull();
  });

  it("records and reflects a free quota snapshot", async () => {
    const quota: QuotaSnapshot = { period: "2026-07", remaining: 2, limit: 5 };

    await useEntitlementStore.getState().applyProxyQuota(quota, "free");

    expect(recordFreeAiQuotaMock).toHaveBeenCalledWith(quota);
    expect(recordProAiQuotaMock).not.toHaveBeenCalled();
    const state = useEntitlementStore.getState();
    expect(state.freeAiRemaining).toBe(2);
    expect(state.freeAiLimit).toBe(5);
    // The Pro remaining is untouched by a free-metered call.
    expect(state.aiQuotaRemaining).toBe(0);
  });
});

describe("activateLicense", () => {
  it("activates, rehydrates, and reports success", async () => {
    activateMock.mockResolvedValue(proClaims);
    getValidEntitlementMock.mockResolvedValue(proClaims);
    getProAiRemainingMock.mockResolvedValue(100);
    hasStoredLicenseKeyMock.mockResolvedValue(true);

    const ok = await useEntitlementStore.getState().activateLicense("  optia_live_key  ");

    expect(ok).toBe(true);
    expect(activateMock).toHaveBeenCalledWith("optia_live_key");
    const state = useEntitlementStore.getState();
    expect(state.isPro).toBe(true);
    expect(state.activating).toBe(false);
    expect(state.activationError).toBeNull();
  });

  it("surfaces an invalid-key error without granting Pro", async () => {
    activateMock.mockRejectedValue(new LicenseError("invalid", "This license key is not valid."));

    const ok = await useEntitlementStore.getState().activateLicense("bad-key");

    expect(ok).toBe(false);
    const state = useEntitlementStore.getState();
    expect(state.isPro).toBe(false);
    expect(state.activating).toBe(false);
    expect(state.activationError).toBe("This license key is not valid.");
  });

  it("shows a rate-limit message with the retry delay", async () => {
    activateMock.mockRejectedValue(new LicenseError("rate_limited", "slow down", 30));

    await useEntitlementStore.getState().activateLicense("key");

    expect(useEntitlementStore.getState().activationError).toBe(
      "Too many attempts. Try again in 30s.",
    );
  });

  it("omits the retry delay when the server gives no Retry-After", async () => {
    activateMock.mockRejectedValue(new LicenseError("rate_limited", "slow down"));

    await useEntitlementStore.getState().activateLicense("key");

    expect(useEntitlementStore.getState().activationError).toBe("Too many attempts.");
  });

  it("maps an unexpected (non-LicenseError) failure to a generic message", async () => {
    activateMock.mockRejectedValue(new Error("boom"));

    const ok = await useEntitlementStore.getState().activateLicense("key");

    expect(ok).toBe(false);
    expect(useEntitlementStore.getState().activationError).toBe(
      "Activation failed. Please try again.",
    );
  });
});

describe("deactivateLicense", () => {
  it("clears all flags back to the free tier", async () => {
    useEntitlementStore.setState({
      isPro: true,
      tier: "pro",
      aiQuotaRemaining: 10,
      quotaLimit: 100,
      expiresAt: Date.now(),
      canUseAdvancedOptions: true,
      canUseMultiLanguage: true,
      canUseSchema: true,
      canBringOwnKey: true,
      hasLicenseKey: true,
      activationError: "prior error",
    });
    deactivateMock.mockResolvedValue();
    getValidEntitlementMock.mockResolvedValue(null);
    hasStoredLicenseKeyMock.mockResolvedValue(false);

    await useEntitlementStore.getState().deactivateLicense();

    expect(deactivateMock).toHaveBeenCalled();
    const state = useEntitlementStore.getState();
    expect(state.isPro).toBe(false);
    expect(state.tier).toBe("free");
    expect(state.hasLicenseKey).toBe(false);
    expect(state.aiQuotaRemaining).toBe(0);
    expect(state.quotaLimit).toBe(0);
    expect(state.expiresAt).toBeNull();
    expect(state.canUseAdvancedOptions).toBe(false);
    expect(state.canUseMultiLanguage).toBe(false);
    expect(state.canUseSchema).toBe(false);
    expect(state.canBringOwnKey).toBe(false);
    expect(state.activationError).toBeNull();
  });
});

describe("initEntitlementSync", () => {
  it("re-hydrates on watched local key changes, and is idempotent", () => {
    initEntitlementSync();
    initEntitlementSync(); // idempotent: only one listener is ever registered
    const addListener = vi.mocked(chrome.storage.onChanged.addListener);
    expect(addListener).toHaveBeenCalledTimes(1);

    const listener = addListener.mock.calls[0][0];
    getValidEntitlementMock.mockResolvedValue(null);

    // Each of the four watched keys re-triggers hydration.
    for (const key of [ENTITLEMENT_TOKEN_KEY, LICENSE_KEY_KEY, PRO_AI_QUOTA_KEY, FREE_AI_QUOTA_KEY]) {
      getValidEntitlementMock.mockClear();
      listener({ [key]: { newValue: "x" } }, "local");
      expect(getValidEntitlementMock, `${key} should re-hydrate`).toHaveBeenCalled();
    }

    // Unrelated keys and non-local areas are ignored.
    getValidEntitlementMock.mockClear();
    listener({ unrelated_key: { newValue: 1 } }, "local");
    listener({ [ENTITLEMENT_TOKEN_KEY]: { newValue: "x" } }, "session");
    expect(getValidEntitlementMock).not.toHaveBeenCalled();
  });
});
