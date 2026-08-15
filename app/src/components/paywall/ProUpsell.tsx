import { useCheckoutStore } from "@/lib/checkout-store";
import { useEntitlementStore } from "@/lib/entitlement-store";

/** Friendly upsell shown in place of a Pro-gated feature for free users. */
export function ProUpsell({ children }: { children: React.ReactNode }) {
  const isPro = useEntitlementStore((s) => s.isPro);
  const openPaywall = useCheckoutStore((s) => s.openPaywall);

  return (
    <div className="mt-3 rounded-card border border-border bg-surface-2 p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="rounded-pill bg-brand px-2 py-0.5 text-[11px] font-medium text-brand-fg">
          Pro
        </span>
        {!isPro && (
          <button
            type="button"
            onClick={() => openPaywall("feature")}
            className="text-[12px] font-semibold text-brand underline-offset-2 transition-colors hover:underline"
          >
            Upgrade
          </button>
        )}
      </div>
      <p className="text-body-12 text-muted">{children}</p>
    </div>
  );
}
