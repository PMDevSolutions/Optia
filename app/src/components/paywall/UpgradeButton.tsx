import { Sparkles } from "lucide-react";
import { useCheckoutStore } from "@/lib/checkout-store";
import { useEntitlementStore } from "@/lib/entitlement-store";

/**
 * Persistent, quiet upgrade entry point for free users. Renders nothing until
 * the entitlement has loaded (so Pro users never see a flash) and nothing for
 * Pro users.
 */
export function UpgradeButton() {
  const entitlementLoaded = useEntitlementStore((s) => s.entitlementLoaded);
  const isPro = useEntitlementStore((s) => s.isPro);
  const openPaywall = useCheckoutStore((s) => s.openPaywall);

  if (!entitlementLoaded || isPro) return null;

  return (
    <button
      type="button"
      onClick={() => openPaywall("header")}
      className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-brand-tint px-3 text-[13px] font-semibold text-brand transition-colors hover:bg-brand hover:text-brand-fg"
    >
      <Sparkles className="h-3.5 w-3.5" />
      Upgrade
    </button>
  );
}
