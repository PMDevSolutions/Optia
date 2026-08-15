// Pro plan catalog for the paywall. Price IDs are per-environment (Stripe test
// mode for dev/staging), selected at build time via Vite mode like
// BACKEND_BASE_URL. Display amounts must match the Stripe dashboard — the
// backend validates the priceId but never tells the client the price.

const isProduction = import.meta.env.MODE === "production";

export interface Plan {
  id: "monthly" | "annual";
  priceId: string;
  amountLabel: string;
  intervalLabel: string;
  badge?: string;
}

// TODO(confirm): production price IDs are still placeholders in the backend's
// wrangler.toml; substitute the live IDs before release.
export const PLANS: Plan[] = [
  {
    id: "monthly",
    priceId: isProduction
      ? "__OPTIA_LIVE_PRICE_PRO_MONTHLY__"
      : "price_1U4neeDQEfCKbFEuayNpkn1V",
    amountLabel: "$5",
    intervalLabel: "/month",
  },
  {
    id: "annual",
    priceId: isProduction
      ? "__OPTIA_LIVE_PRICE_PRO_ANNUAL__"
      : "price_1U4neeDQEfCKbFEuBbuVsrax",
    amountLabel: "$50",
    intervalLabel: "/year",
    badge: "2 months free",
  },
];

// Quota copy numbers; the server-issued entitlement/quota snapshots are the
// runtime truth, these are only fallbacks for marketing copy before a snapshot
// exists.
export const FREE_AI_LIMIT = 25;
export const PRO_AI_LIMIT = 1000;

/**
 * Friendly label for when the monthly AI allowance resets: the first day of
 * the month after `now`, e.g. "Sep 1". Quota periods are "YYYY-MM" so the
 * reset moment is always the month boundary.
 */
export function quotaResetLabel(now: Date = new Date()): string {
  const reset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return reset.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
