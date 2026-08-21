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

// LIVE price IDs created 2026-08-20 on acct_1U6Z2iRDHttKIwLT ("Optia Pro",
// prod_V6tNs5AY55KP6R: $5/mo, $50/yr). Must match the backend wrangler.toml
// production STRIPE_PRICE_* vars — the server rejects unknown priceIds.
export const PLANS: Plan[] = [
  {
    id: "monthly",
    priceId: isProduction
      ? "price_1U6faNRDHttKIwLT8gOTOVIe"
      : "price_1U4l83CRgigSDnjuBaR9Fg00",
    amountLabel: "$5",
    intervalLabel: "/month",
  },
  {
    id: "annual",
    priceId: isProduction
      ? "price_1U6flvRDHttKIwLTjOIPGpVG"
      : "price_1U4l83CRgigSDnjusx4BHyWo",
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
