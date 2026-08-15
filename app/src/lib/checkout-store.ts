import { create } from "zustand";
import {
  BillingError,
  createCheckoutSession,
  getCheckoutSessionStatus,
} from "@/lib/billing";
import { getInstallId } from "@/lib/entitlement";
import { useEntitlementStore } from "@/lib/entitlement-store";
import { PLANS } from "@/lib/plans";
import { getStorageItem, removeStorageItem, setStorageItem } from "@/lib/storage";
import { openInNewTab } from "@/lib/tabs";

// Paywall visibility + the checkout claim state machine. After Checkout opens
// in a new tab, the panel polls /billing/session/:id until the webhook mints
// the license key, then activates it locally — the entitlement storage sync
// then flips every surface to Pro without a reload. The pending session is
// persisted so an interrupted claim resumes on the next panel mount.

export type CheckoutPhase = "idle" | "creating" | "polling" | "activating" | "success" | "error";
export type PaywallTrigger = "header" | "quota" | "feature" | "settings";

export const PENDING_CHECKOUT_KEY = "pending_checkout";

export interface PendingCheckout {
  sessionId: string;
  createdAt: number;
}

// The server-side claim record lives for 1h; older pending sessions are stale.
const PENDING_MAX_AGE_MS = 60 * 60 * 1000;
// Poll fast while the user is presumably paying, then settle down.
const FAST_POLL_MS = 4_000;
const SLOW_POLL_MS = 10_000;
const FAST_POLL_WINDOW_MS = 60_000;
const GIVE_UP_AFTER_MS = 10 * 60 * 1000;

const TIMEOUT_MESSAGE =
  "Still waiting for payment confirmation. If you completed payment, you can finish activation with the license key from your receipt in extension options.";
const GONE_MESSAGE =
  "This checkout session has expired. If you completed payment, activate the license key from your receipt in extension options.";
const FORBIDDEN_MESSAGE =
  "This checkout session belongs to a different install. Activate your license key in extension options.";
const ACTIVATION_FAILED_MESSAGE =
  "Payment confirmed, but activation failed. Activate the license key from your receipt in extension options.";
const CHECKOUT_FAILED_MESSAGE = "Could not start checkout. Please try again.";

interface CheckoutStore {
  paywallOpen: boolean;
  trigger: PaywallTrigger | null;
  phase: CheckoutPhase;
  error: string | null;
  sessionId: string | null;
  openPaywall: (trigger: PaywallTrigger) => void;
  closePaywall: () => void;
  startCheckout: (planId: "monthly" | "annual") => Promise<void>;
  resumePendingCheckout: () => Promise<void>;
  cancelCheckout: () => Promise<void>;
}

let pollTimer: ReturnType<typeof setTimeout> | null = null;

function stopPolling(): void {
  if (pollTimer !== null) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

async function clearPending(): Promise<void> {
  await removeStorageItem(PENDING_CHECKOUT_KEY);
}

/** One poll step; re-arms itself until a terminal state or the give-up deadline. */
async function pollSession(sessionId: string, startedAt: number): Promise<void> {
  const set = useCheckoutStore.setState;
  const elapsed = Date.now() - startedAt;
  if (elapsed > GIVE_UP_AFTER_MS) {
    // Keep the pending record: the next panel open gets one more try within
    // the server's claim TTL.
    set({ phase: "error", error: TIMEOUT_MESSAGE });
    return;
  }

  let outcome: Awaited<ReturnType<typeof getCheckoutSessionStatus>> | null = null;
  try {
    outcome = await getCheckoutSessionStatus(sessionId, await getInstallId());
  } catch (error) {
    if (error instanceof BillingError && error.code === "forbidden") {
      await clearPending();
      set({ phase: "error", error: FORBIDDEN_MESSAGE });
      return;
    }
    // Transient (network/server/rate limit): keep polling toward the deadline.
  }

  // A cancel while the request was in flight wins.
  if (useCheckoutStore.getState().sessionId !== sessionId) return;

  if (outcome?.status === "ready") {
    set({ phase: "activating" });
    const activated = await useEntitlementStore.getState().activateLicense(outcome.licenseKey);
    await clearPending();
    if (activated) {
      set({ phase: "success", error: null });
    } else {
      set({ phase: "error", error: ACTIVATION_FAILED_MESSAGE });
    }
    return;
  }

  if (outcome?.status === "gone") {
    await clearPending();
    if (useEntitlementStore.getState().isPro) {
      // Another context already claimed and activated; nothing to do.
      set({ phase: "success", error: null });
    } else {
      set({ phase: "error", error: GONE_MESSAGE });
    }
    return;
  }

  const interval = elapsed < FAST_POLL_WINDOW_MS ? FAST_POLL_MS : SLOW_POLL_MS;
  pollTimer = setTimeout(() => {
    void pollSession(sessionId, startedAt);
  }, interval);
}

function beginPolling(sessionId: string, startedAt: number): void {
  stopPolling();
  useCheckoutStore.setState({ phase: "polling", sessionId, error: null });
  void pollSession(sessionId, startedAt);
}

export const useCheckoutStore = create<CheckoutStore>((set, get) => ({
  paywallOpen: false,
  trigger: null,
  phase: "idle",
  error: null,
  sessionId: null,

  openPaywall: (trigger) => {
    set({ paywallOpen: true, trigger });
  },

  // Closing the paywall never cancels an in-flight claim — the user may just
  // be getting back to work while the payment settles.
  closePaywall: () => {
    set({ paywallOpen: false, trigger: null });
    if (get().phase === "success") set({ phase: "idle", error: null, sessionId: null });
  },

  startCheckout: async (planId) => {
    const plan = PLANS.find((p) => p.id === planId);
    if (!plan || get().phase === "creating" || get().phase === "polling") return;
    set({ phase: "creating", error: null });
    try {
      const session = await createCheckoutSession(plan.priceId, await getInstallId());
      await setStorageItem<PendingCheckout>(PENDING_CHECKOUT_KEY, {
        sessionId: session.sessionId,
        createdAt: Date.now(),
      });
      await openInNewTab(session.url);
      beginPolling(session.sessionId, Date.now());
    } catch (error) {
      const message =
        error instanceof BillingError && error.code === "rate_limited"
          ? `Too many attempts.${error.retryAfterSeconds ? ` Try again in ${error.retryAfterSeconds}s.` : ""}`
          : CHECKOUT_FAILED_MESSAGE;
      set({ phase: "error", error: message });
    }
  },

  resumePendingCheckout: async () => {
    if (get().phase !== "idle") return;
    const pending = await getStorageItem<PendingCheckout>(PENDING_CHECKOUT_KEY);
    if (!pending) return;
    if (Date.now() - pending.createdAt > PENDING_MAX_AGE_MS) {
      await clearPending();
      return;
    }
    if (useEntitlementStore.getState().isPro) {
      await clearPending();
      return;
    }
    // Fresh give-up window on resume; the stored createdAt only bounds overall age.
    beginPolling(pending.sessionId, Date.now());
  },

  cancelCheckout: async () => {
    stopPolling();
    await clearPending();
    set({ phase: "idle", error: null, sessionId: null });
  },
}));
