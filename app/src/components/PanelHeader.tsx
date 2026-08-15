import { OptiaWordmark } from "@/components/ui/Logo";
import { UpgradeButton } from "@/components/paywall/UpgradeButton";

/**
 * Shared side-panel header: wordmark on the left, the persistent Upgrade entry
 * point (free users only) plus page-specific actions on the right.
 */
export function PanelHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="mb-3 flex items-center justify-between">
      <OptiaWordmark />
      <div className="flex items-center gap-1.5">
        <UpgradeButton />
        {children}
      </div>
    </header>
  );
}
