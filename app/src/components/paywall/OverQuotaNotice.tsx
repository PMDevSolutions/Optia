import { Button } from "@/components/ui/Button";
import { useCheckoutStore } from "@/lib/checkout-store";
import { useAiStatus, useEntitlementStore } from "@/lib/entitlement-store";
import { FREE_AI_LIMIT, PRO_AI_LIMIT, quotaResetLabel } from "@/lib/plans";

/**
 * Friendly banner when this month's AI allowance is used up. Free users get an
 * upgrade CTA; Pro users just see when the quota resets (their next step —
 * BYO key — is a settings concern, not a sale).
 */
export function OverQuotaNotice() {
  const { mode, limit } = useAiStatus();
  const isPro = useEntitlementStore((s) => s.isPro);
  const openPaywall = useCheckoutStore((s) => s.openPaywall);

  if (mode !== "locked") return null;

  if (isPro) {
    return (
      <div className="rounded-card border border-border bg-surface-2 p-3">
        <p className="text-body-12 text-muted">
          You&apos;ve used this month&apos;s {(limit ?? PRO_AI_LIMIT).toLocaleString()} Pro AI
          generations. Your allowance resets {quotaResetLabel()}. Add your own Anthropic key in
          settings for unlimited AI.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-card border border-border bg-surface-2 p-3">
      <p className="text-body-12 text-muted">
        You&apos;ve used all {limit ?? FREE_AI_LIMIT} free AI generations this month. Your
        allowance resets {quotaResetLabel()}.
      </p>
      <Button size="small" className="self-start" onClick={() => openPaywall("quota")}>
        Upgrade to Pro
      </Button>
    </div>
  );
}
