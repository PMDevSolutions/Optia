import { useEffect, useRef, useState } from "react";
import { Check, Globe2, KeyRound, Loader2, ScanSearch, Sparkles, Braces, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { OptiaMark } from "@/components/ui/Logo";
import { useCheckoutStore } from "@/lib/checkout-store";
import { useEntitlementStore } from "@/lib/entitlement-store";
import { FREE_AI_LIMIT, PLANS, PRO_AI_LIMIT, quotaResetLabel, type Plan } from "@/lib/plans";
import { openOptionsPage } from "@/lib/tabs";
import { cn } from "@/lib/utils";

const BENEFITS = [
  {
    icon: Sparkles,
    tint: "bg-brand/15 text-brand",
    title: `${PRO_AI_LIMIT.toLocaleString()} AI generations a month`,
    description: `Titles, descriptions, H2s, and alt text — up from ${FREE_AI_LIMIT} on the free plan`,
  },
  {
    icon: KeyRound,
    tint: "bg-accent/15 text-accent",
    title: "Bring your own Anthropic key",
    description: "Use your own API key for unlimited AI with no monthly cap",
  },
  {
    icon: Globe2,
    tint: "bg-good/15 text-good",
    title: "Multi-language recommendations",
    description: "AI output in your site's language, not just English",
  },
  {
    icon: ScanSearch,
    tint: "bg-brand/15 text-brand",
    title: "Advanced page analysis",
    description: "Page type and secondary keywords sharpen every recommendation",
  },
  {
    icon: Braces,
    tint: "bg-accent/15 text-accent",
    title: "Schema markup generation",
    description: "JSON-LD tailored to your page, ready to paste",
  },
];

function PlanSelector({
  selected,
  onSelect,
}: {
  selected: Plan["id"];
  onSelect: (id: Plan["id"]) => void;
}) {
  const refs = useRef<Partial<Record<Plan["id"], HTMLButtonElement | null>>>({});

  return (
    <div role="radiogroup" aria-label="Billing plan" className="flex gap-2">
      {PLANS.map((plan) => {
        const isSelected = plan.id === selected;
        return (
          <button
            key={plan.id}
            ref={(el) => {
              refs.current[plan.id] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onSelect(plan.id)}
            onKeyDown={(event) => {
              if (["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(event.key)) {
                event.preventDefault();
                const other = PLANS.find((p) => p.id !== plan.id);
                if (other) {
                  onSelect(other.id);
                  refs.current[other.id]?.focus();
                }
              }
            }}
            className={cn(
              "flex flex-1 flex-col items-start gap-0.5 rounded-card border p-3 text-left transition-colors",
              isSelected
                ? "border-brand bg-brand-tint"
                : "border-border bg-surface-2 hover:bg-surface-3",
            )}
          >
            <span className="text-body-semibold capitalize text-ink">{plan.id}</span>
            <span className="text-body text-ink">
              <span className="font-semibold">{plan.amountLabel}</span>
              <span className="text-muted">{plan.intervalLabel}</span>
            </span>
            {plan.badge && (
              <span className="mt-0.5 rounded-pill bg-good/15 px-2 py-0.5 text-[11px] font-medium text-good">
                {plan.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** The paywall: benefits + plan picker, then checkout progress and outcome. */
export function PaywallModal() {
  const paywallOpen = useCheckoutStore((s) => s.paywallOpen);
  const trigger = useCheckoutStore((s) => s.trigger);
  const phase = useCheckoutStore((s) => s.phase);
  const error = useCheckoutStore((s) => s.error);
  const closePaywall = useCheckoutStore((s) => s.closePaywall);
  const startCheckout = useCheckoutStore((s) => s.startCheckout);
  const cancelCheckout = useCheckoutStore((s) => s.cancelCheckout);
  const isPro = useEntitlementStore((s) => s.isPro);
  const freeAiLimit = useEntitlementStore((s) => s.freeAiLimit);
  const [selectedPlan, setSelectedPlan] = useState<Plan["id"]>("monthly");

  // If Pro arrives some other way (options-page activation, another window)
  // while the paywall is up, close it rather than ask a Pro user to pay.
  useEffect(() => {
    if (paywallOpen && isPro && phase !== "success" && phase !== "activating") {
      closePaywall();
    }
  }, [paywallOpen, isPro, phase, closePaywall]);

  if (!paywallOpen) return null;
  if (isPro && phase !== "success" && phase !== "activating") return null;

  const busy = phase === "polling" || phase === "activating";

  return (
    <Dialog open onClose={closePaywall} labelledBy="paywall-title">
      <button
        onClick={closePaywall}
        aria-label="Close"
        className="absolute right-3 top-3 rounded-full p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="mb-5 flex flex-col items-center text-center">
        <OptiaMark size={44} />
        <h2 id="paywall-title" className="mt-3 text-h1 text-ink">
          Optia Pro
        </h2>
        {phase === "success" ? (
          <p className="mt-1 text-body text-muted">Welcome aboard</p>
        ) : (
          <p className="mt-1 text-body text-muted">Everything in Free, plus the full AI toolkit</p>
        )}
      </div>

      {(phase === "idle" || phase === "creating" || phase === "error") && (
        <>
          {trigger === "quota" && (
            <p className="mb-4 rounded-card bg-surface-2 p-3 text-body-12 text-muted">
              You&apos;ve used all {freeAiLimit ?? FREE_AI_LIMIT} free AI generations this month —
              your allowance resets {quotaResetLabel()}.
            </p>
          )}

          <div className="mb-5 flex flex-col gap-3.5">
            {BENEFITS.map(({ icon: Icon, tint, title, description }) => (
              <div key={title} className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full",
                    tint,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-body-semibold text-ink">{title}</h3>
                  <p className="text-body-12 text-muted">{description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mb-4">
            <PlanSelector selected={selectedPlan} onSelect={setSelectedPlan} />
          </div>

          {phase === "error" && error && (
            <p className="mb-3 text-body-12 text-poor" role="alert">
              {error}
            </p>
          )}

          <Button
            onClick={() => void startCheckout(selectedPlan)}
            loading={phase === "creating"}
            className="w-full"
            showArrow
          >
            {phase === "error" ? "Try again" : "Continue to checkout"}
          </Button>
          <p className="mt-2 text-center text-caption text-faint">
            Secure payment by Stripe — opens in a new tab. Cancel anytime.
          </p>
          <button
            type="button"
            onClick={() => {
              openOptionsPage();
              closePaywall();
            }}
            className="mx-auto mt-3 block text-body-12 text-muted underline-offset-2 transition-colors hover:text-ink hover:underline"
          >
            Already have a license key? Activate it in extension options
          </button>
        </>
      )}

      {busy && (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
          <p className="text-body text-muted">
            Waiting for payment confirmation… you can keep using Optia, we&apos;ll activate Pro
            automatically.
          </p>
          <Button variant="ghost" size="small" onClick={() => void cancelCheckout()}>
            Cancel
          </Button>
        </div>
      )}

      {phase === "success" && (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-good/15">
            <Check className="h-6 w-6 text-good" />
          </div>
          <p className="text-body text-ink">
            You&apos;re on Pro. AI limits raised, advanced tools unlocked.
          </p>
          <Button onClick={closePaywall} className="w-full">
            Done
          </Button>
        </div>
      )}
    </Dialog>
  );
}
