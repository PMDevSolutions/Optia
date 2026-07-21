import { create } from "zustand";
import {
  activate,
  deactivate,
  getFreeAiQuota,
  getProAiRemaining,
  getValidEntitlement,
  hasStoredLicenseKey,
  recordFreeAiQuota,
  recordProAiQuota,
  ENTITLEMENT_TOKEN_KEY,
  FREE_AI_QUOTA_KEY,
  LICENSE_KEY_KEY,
  PRO_AI_QUOTA_KEY,
  type QuotaSnapshot,
} from "@/lib/entitlement";
import { LicenseError } from "@/lib/backend";
import { useStore } from "@/lib/store";

// Feature-flag store over the entitlement layer. The rest of the app reads
// these flags (useCanUseAI / useAiStatus / the canUse* booleans) — never raw
// license/token data.

interface EntitlementStore {
  entitlementLoaded: boolean;
  isPro: boolean;
  tier: "free" | "pro";
  expiresAt: number | null; // ms epoch, for status display
  quotaLimit: number; // Pro monthly limit from the token (0 for free)
  aiQuotaRemaining: number; // Pro remaining, server-authoritative (0 for free)
  aiQuotaPeriod: string | null; // period the Pro remaining belongs to (YYYY-MM)
  freeAiRemaining: number | null; // free monthly remaining; null = unknown (no call yet this period)
  freeAiLimit: number | null;
  freeAiPeriod: string | null; // period the free remaining belongs to (YYYY-MM)
  canUseAdvancedOptions: boolean;
  canUseMultiLanguage: boolean;
  canUseSchema: boolean;
  canBringOwnKey: boolean;
  hasLicenseKey: boolean;
  activating: boolean;
  activationError: string | null;
  hydrateEntitlement: () => Promise<void>;
  activateLicense: (licenseKey: string) => Promise<boolean>;
  deactivateLicense: () => Promise<void>;
  applyProxyQuota: (quota: QuotaSnapshot, subject: "pro" | "free") => Promise<void>;
}

// Reset shape for the free/expired tier. Free-quota fields are NOT reset here —
// they are install-scoped and hydrated separately.
const freeFlags = {
  isPro: false,
  tier: "free" as const,
  expiresAt: null,
  quotaLimit: 0,
  aiQuotaRemaining: 0,
  canUseAdvancedOptions: false,
  canUseMultiLanguage: false,
  canUseSchema: false,
  canBringOwnKey: false,
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
  aiQuotaPeriod: null,
  freeAiRemaining: null,
  freeAiLimit: null,
  freeAiPeriod: null,
  hasLicenseKey: false,
  activating: false,
  activationError: null,

  hydrateEntitlement: async () => {
    const claims = await getValidEntitlement();
    const hasLicenseKey = await hasStoredLicenseKey();
    const freeQuota = await getFreeAiQuota();
    const freeAiRemaining = freeQuota ? freeQuota.remaining : null;
    const freeAiLimit = freeQuota ? freeQuota.limit : null;
    const freeAiPeriod = freeQuota ? freeQuota.period : null;

    if (!claims || claims.tier !== "pro") {
      set({
        entitlementLoaded: true,
        hasLicenseKey,
        freeAiRemaining,
        freeAiLimit,
        freeAiPeriod,
        aiQuotaPeriod: null,
        ...freeFlags,
      });
      return;
    }
    set({
      entitlementLoaded: true,
      hasLicenseKey,
      isPro: true,
      tier: "pro",
      expiresAt: claims.exp * 1000,
      quotaLimit: claims.quotaLimit,
      aiQuotaRemaining: await getProAiRemaining(claims),
      aiQuotaPeriod: claims.period,
      freeAiRemaining,
      freeAiLimit,
      freeAiPeriod,
      canUseAdvancedOptions: true,
      canUseMultiLanguage: true,
      canUseSchema: true,
      canBringOwnKey: true,
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
    await useEntitlementStore.getState().hydrateEntitlement();
    set({ activationError: null });
  },

  applyProxyQuota: async (quota, subject) => {
    // Concurrent generations (generate-all) resolve out of order; keep the most
    // conservative (lowest) remaining for the SAME period so the cache never
    // overstates the allowance. A different period is a rollover — take it as-is.
    const state = useEntitlementStore.getState();
    if (subject === "pro") {
      const known = state.quotaLimit > 0 ? state.aiQuotaRemaining : null;
      const sameMonth = quota.period === state.aiQuotaPeriod;
      const remaining = sameMonth && known !== null ? Math.min(known, quota.remaining) : quota.remaining;
      const reconciled = { ...quota, remaining };
      await recordProAiQuota(reconciled);
      set({ aiQuotaRemaining: remaining, quotaLimit: reconciled.limit, aiQuotaPeriod: quota.period });
    } else {
      const sameMonth = quota.period === state.freeAiPeriod;
      const remaining =
        sameMonth && state.freeAiRemaining !== null
          ? Math.min(state.freeAiRemaining, quota.remaining)
          : quota.remaining;
      const reconciled = { ...quota, remaining };
      await recordFreeAiQuota(reconciled);
      set({ freeAiRemaining: remaining, freeAiLimit: reconciled.limit, freeAiPeriod: quota.period });
    }
  },
}));

// ── AI availability: the single place the three access paths are decided ──
//
// BYO key (Pro + own Anthropic key) → unlimited direct calls (never metered).
// Pro without key → hosted proxy, higher monthly cap (server-metered).
// Free → hosted proxy, capped monthly allowance (server-metered).
// A stored key only unlocks the direct path when the user is Pro — BYO key is a
// Pro feature, so free users can never self-serve AI with a key.

export type AiMode = "byok" | "pro" | "free" | "locked";

export interface AiStatus {
  mode: AiMode;
  remaining: number | null; // null = unlimited (byok) or unknown (free, pre-call)
  limit: number | null;
}

interface AiInputs {
  apiKey: string;
  isPro: boolean;
  aiQuotaRemaining: number;
  quotaLimit: number;
  freeAiRemaining: number | null;
  freeAiLimit: number | null;
}

function computeAiStatus(i: AiInputs): AiStatus {
  if (i.isPro && i.apiKey) return { mode: "byok", remaining: null, limit: null };
  if (i.isPro) {
    return i.aiQuotaRemaining > 0
      ? { mode: "pro", remaining: i.aiQuotaRemaining, limit: i.quotaLimit }
      : { mode: "locked", remaining: 0, limit: i.quotaLimit };
  }
  // Free tier: unknown remaining (null) is treated as available.
  if (i.freeAiRemaining === null || i.freeAiRemaining > 0) {
    return { mode: "free", remaining: i.freeAiRemaining, limit: i.freeAiLimit };
  }
  return { mode: "locked", remaining: 0, limit: i.freeAiLimit };
}

export function useAiStatus(): AiStatus {
  const apiKey = useStore((s) => s.apiKey);
  const isPro = useEntitlementStore((s) => s.isPro);
  const aiQuotaRemaining = useEntitlementStore((s) => s.aiQuotaRemaining);
  const quotaLimit = useEntitlementStore((s) => s.quotaLimit);
  const freeAiRemaining = useEntitlementStore((s) => s.freeAiRemaining);
  const freeAiLimit = useEntitlementStore((s) => s.freeAiLimit);
  return computeAiStatus({ apiKey, isPro, aiQuotaRemaining, quotaLimit, freeAiRemaining, freeAiLimit });
}

export function useCanUseAI(): boolean {
  return useAiStatus().mode !== "locked";
}

/** Non-reactive Ai status for imperative call sites (async handlers). */
export function aiStatusNow(): AiStatus {
  const e = useEntitlementStore.getState();
  return computeAiStatus({
    apiKey: useStore.getState().apiKey,
    isPro: e.isPro,
    aiQuotaRemaining: e.aiQuotaRemaining,
    quotaLimit: e.quotaLimit,
    freeAiRemaining: e.freeAiRemaining,
    freeAiLimit: e.freeAiLimit,
  });
}

let syncInitialized = false;

/**
 * Keeps the store in sync with entitlement/quota changes made in other
 * extension contexts (options page, background refresh, a sidepanel AI call)
 * via chrome.storage.onChanged. Idempotent; a no-op in the browser dev preview.
 */
export function initEntitlementSync(): void {
  if (syncInitialized) return;
  if (typeof chrome === "undefined" || !chrome.storage?.onChanged) return;
  syncInitialized = true;
  const watched = [ENTITLEMENT_TOKEN_KEY, LICENSE_KEY_KEY, PRO_AI_QUOTA_KEY, FREE_AI_QUOTA_KEY];
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (watched.some((key) => changes[key])) {
      void useEntitlementStore.getState().hydrateEntitlement();
    }
  });
}
