import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  useEntitlementStore,
  canUseAINow,
  isMeteredAiCall,
  initEntitlementSync,
} from "@/lib/entitlement-store";
import { useStore } from "@/lib/store";
import {
  activate,
  consumeAiQuota,
  deactivate,
  getAiQuotaRemaining,
  getValidEntitlement,
  hasStoredLicenseKey,
  ENTITLEMENT_TOKEN_KEY,
  type EntitlementClaims,
} from "@/lib/entitlement";
import { LicenseError } from "@/lib/backend";

vi.mock("@/lib/entitlement", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/entitlement")>();
  return {
    ...original,
    getValidEntitlement: vi.fn(),
    getAiQuotaRemaining: vi.fn(),
    hasStoredLicenseKey: vi.fn(),
    activate: vi.fn(),
    deactivate: vi.fn(),
    consumeAiQuota: vi.fn(),
  };
});

const getValidEntitlementMock = vi.mocked(getValidEntitlement);
const getAiQuotaRemainingMock = vi.mocked(getAiQuotaRemaining);
const hasStoredLicenseKeyMock = vi.mocked(hasStoredLicenseKey);
const activateMock = vi.mocked(activate);
const deactivateMock = vi.mocked(deactivate);
const consumeAiQuotaMock = vi.mocked(consumeAiQuota);

const proClaims: EntitlementClaims = {
  sub: "lic_1",
  subjectType: "license",
  tier: "pro",
  quotaLimit: 100,
  period: "2026-07",
  exp: Math.floor(Date.now() / 1000) + 3600,
  iat: Math.floor(Date.now() / 1000),
};

function resetEntitlementState() {
  useEntitlementStore.setState({
    entitlementLoaded: false,
    isPro: false,
    tier: "free",
    expiresAt: null,
    quotaLimit: 0,
    aiQuotaRemaining: 0,
    canUseAdvancedOptions: false,
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
  getAiQuotaRemainingMock.mockResolvedValue(0);
});

describe("hydrateEntitlement", () => {
  it("maps a valid Pro entitlement to flags", async () => {
    getValidEntitlementMock.mockResolvedValue(proClaims);
    getAiQuotaRemainingMock.mockResolvedValue(42);
    hasStoredLicenseKeyMock.mockResolvedValue(true);

    await useEntitlementStore.getState().hydrateEntitlement();

    const state = useEntitlementStore.getState();
    expect(state.entitlementLoaded).toBe(true);
    expect(state.isPro).toBe(true);
    expect(state.tier).toBe("pro");
    expect(state.expiresAt).toBe(proClaims.exp * 1000);
    expect(state.quotaLimit).toBe(100);
    expect(state.aiQuotaRemaining).toBe(42);
    expect(state.canUseAdvancedOptions).toBe(true);
    expect(state.hasLicenseKey).toBe(true);
  });

  it("resolves missing or expired entitlements to the free tier", async () => {
    getValidEntitlementMock.mockResolvedValue(null);

    await useEntitlementStore.getState().hydrateEntitlement();

    const state = useEntitlementStore.getState();
    expect(state.entitlementLoaded).toBe(true);
    expect(state.isPro).toBe(false);
    expect(state.aiQuotaRemaining).toBe(0);
    expect(state.canUseAdvancedOptions).toBe(false);
  });

  it("never grants Pro for a non-pro tier claim", async () => {
    getValidEntitlementMock.mockResolvedValue({ ...proClaims, tier: "trial" });

    await useEntitlementStore.getState().hydrateEntitlement();

    expect(useEntitlementStore.getState().isPro).toBe(false);
  });
});

describe("canUseAINow / isMeteredAiCall", () => {
  it("follows the apiKey × isPro × quota truth table", () => {
    // free, no key
    expect(canUseAINow()).toBe(false);
    expect(isMeteredAiCall()).toBe(false);

    // own key always wins, never metered
    useStore.setState({ apiKey: "sk-own" });
    expect(canUseAINow()).toBe(true);
    expect(isMeteredAiCall()).toBe(false);

    // pro with quota, no key: allowed and metered
    useStore.setState({ apiKey: "" });
    useEntitlementStore.setState({ isPro: true, aiQuotaRemaining: 5 });
    expect(canUseAINow()).toBe(true);
    expect(isMeteredAiCall()).toBe(true);

    // pro with exhausted quota, no key: blocked
    useEntitlementStore.setState({ aiQuotaRemaining: 0 });
    expect(canUseAINow()).toBe(false);

    // pro with exhausted quota but own key: allowed, not metered
    useStore.setState({ apiKey: "sk-own" });
    expect(canUseAINow()).toBe(true);
    expect(isMeteredAiCall()).toBe(false);
  });
});

describe("activateLicense", () => {
  it("activates, rehydrates, and reports success", async () => {
    activateMock.mockResolvedValue(proClaims);
    getValidEntitlementMock.mockResolvedValue(proClaims);
    getAiQuotaRemainingMock.mockResolvedValue(100);
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
    expect(state.activationError).toBe("This license key is not valid.");
  });

  it("shows a rate-limit message with the retry delay", async () => {
    activateMock.mockRejectedValue(new LicenseError("rate_limited", "slow down", 30));

    await useEntitlementStore.getState().activateLicense("key");

    expect(useEntitlementStore.getState().activationError).toBe(
      "Too many attempts. Try again in 30s.",
    );
  });
});

describe("deactivateLicense", () => {
  it("clears flags back to free", async () => {
    useEntitlementStore.setState({
      isPro: true,
      tier: "pro",
      aiQuotaRemaining: 10,
      canUseAdvancedOptions: true,
      hasLicenseKey: true,
    });
    deactivateMock.mockResolvedValue();

    await useEntitlementStore.getState().deactivateLicense();

    const state = useEntitlementStore.getState();
    expect(deactivateMock).toHaveBeenCalled();
    expect(state.isPro).toBe(false);
    expect(state.hasLicenseKey).toBe(false);
    expect(state.aiQuotaRemaining).toBe(0);
    expect(state.canUseAdvancedOptions).toBe(false);
  });
});

describe("consumeAiQuota", () => {
  it("updates the remaining quota flag", async () => {
    useEntitlementStore.setState({ isPro: true, aiQuotaRemaining: 5 });
    consumeAiQuotaMock.mockResolvedValue(4);

    await useEntitlementStore.getState().consumeAiQuota();

    expect(useEntitlementStore.getState().aiQuotaRemaining).toBe(4);
  });
});

describe("initEntitlementSync", () => {
  it("rehydrates when entitlement storage keys change in another context", () => {
    initEntitlementSync();
    initEntitlementSync(); // idempotent
    const addListener = vi.mocked(chrome.storage.onChanged.addListener);
    expect(addListener).toHaveBeenCalledTimes(1);

    const listener = addListener.mock.calls[0][0];
    getValidEntitlementMock.mockResolvedValue(proClaims);

    listener({ [ENTITLEMENT_TOKEN_KEY]: { newValue: "t" } }, "local");
    expect(getValidEntitlementMock).toHaveBeenCalled();

    getValidEntitlementMock.mockClear();
    listener({ unrelated_key: { newValue: 1 } }, "local");
    listener({ [ENTITLEMENT_TOKEN_KEY]: { newValue: "t" } }, "session");
    expect(getValidEntitlementMock).not.toHaveBeenCalled();
  });
});
