import { create } from "zustand";
import {
  activate,
  consumeAiQuota,
  deactivate,
  getAiQuotaRemaining,
  getValidEntitlement,
  hasStoredLicenseKey,
  AI_USAGE_KEY,
  ENTITLEMENT_TOKEN_KEY,
  LICENSE_KEY_KEY,
} from "@/lib/entitlement";
import { LicenseError } from "@/lib/backend";
import { useStore } from "@/lib/store";

// Feature-flag store over the entitlement layer. The rest of the app reads
// these flags (and useCanUseAI) — never raw license/token data.

interface EntitlementStore {
  entitlementLoaded: boolean;
  isPro: boolean;
  tier: "free" | "pro";
  expiresAt: number | null; // ms epoch, for status display
  quotaLimit: number;
  aiQuotaRemaining: number;
  canUseAdvancedOptions: boolean;
  hasLicenseKey: boolean;
  activating: boolean;
  activationError: string | null;
  hydrateEntitlement: () => Promise<void>;
  activateLicense: (licenseKey: string) => Promise<boolean>;
  deactivateLicense: () => Promise<void>;
  consumeAiQuota: () => Promise<void>;
}

const freeFlags = {
  isPro: false,
  tier: "free" as const,
  expiresAt: null,
  quotaLimit: 0,
  aiQuotaRemaining: 0,
  canUseAdvancedOptions: false,
};

function activationErrorMessage(error: unknown): string {
  if (error instanceof LicenseError) {
    if (error.code === "rate_limited") {
      const wait = error.retryAfterSeconds ? ` Try again in ${error.retryAfterSeconds}s.` : "";
      return `Too many attempts.${wait}`;
    }
    return error.message;
  }
  return "Activation failed. Please try again.";
}

export const useEntitlementStore = create<EntitlementStore>((set) => ({
  entitlementLoaded: false,
  ...freeFlags,
  hasLicenseKey: false,
  activating: false,
  activationError: null,

  hydrateEntitlement: async () => {
    const claims = await getValidEntitlement();
    const hasLicenseKey = await hasStoredLicenseKey();
    if (!claims || claims.tier !== "pro") {
      set({ entitlementLoaded: true, hasLicenseKey, ...freeFlags });
      return;
    }
    set({
      entitlementLoaded: true,
      hasLicenseKey,
      isPro: true,
      tier: "pro",
      expiresAt: claims.exp * 1000,
      quotaLimit: claims.quotaLimit,
      aiQuotaRemaining: await getAiQuotaRemaining(claims),
      canUseAdvancedOptions: true,
    });
  },

  activateLicense: async (licenseKey) => {
    set({ activating: true, activationError: null });
    try {
      await activate(licenseKey.trim());
      await useEntitlementStore.getState().hydrateEntitlement();
      set({ activating: false });
      return true;
    } catch (error) {
      set({ activating: false, activationError: activationErrorMessage(error) });
      return false;
    }
  },

  deactivateLicense: async () => {
    await deactivate();
    set({ hasLicenseKey: false, activationError: null, ...freeFlags });
  },

  consumeAiQuota: async () => {
    const remaining = await consumeAiQuota();
    set({ aiQuotaRemaining: remaining });
  },
}));

/**
 * The single place AI availability is decided: users with their own OpenAI key
 * are never gated (and never metered); otherwise Pro with quota remaining.
 */
export function useCanUseAI(): boolean {
  const apiKey = useStore((state) => state.apiKey);
  const isPro = useEntitlementStore((state) => state.isPro);
  const aiQuotaRemaining = useEntitlementStore((state) => state.aiQuotaRemaining);
  return Boolean(apiKey) || (isPro && aiQuotaRemaining > 0);
}

/** Non-hook variant for imperative call sites (e.g. inside async handlers). */
export function canUseAINow(): boolean {
  const { isPro, aiQuotaRemaining } = useEntitlementStore.getState();
  return Boolean(useStore.getState().apiKey) || (isPro && aiQuotaRemaining > 0);
}

/** True when the current AI call runs on Pro quota (no personal key) and must be metered. */
export function isMeteredAiCall(): boolean {
  return !useStore.getState().apiKey && useEntitlementStore.getState().isPro;
}

let syncInitialized = false;

/**
 * Keeps the store in sync with entitlement changes made in other extension
 * contexts (options page, background refresh) via chrome.storage.onChanged.
 * Idempotent; a no-op outside a chrome-extension context (browser dev preview).
 */
export function initEntitlementSync(): void {
  if (syncInitialized) return;
  if (typeof chrome === "undefined" || !chrome.storage?.onChanged) return;
  syncInitialized = true;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[ENTITLEMENT_TOKEN_KEY] || changes[LICENSE_KEY_KEY] || changes[AI_USAGE_KEY]) {
      void useEntitlementStore.getState().hydrateEntitlement();
    }
  });
}
