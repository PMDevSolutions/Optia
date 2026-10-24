import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EditableRecommendation } from "@/components/EditableRecommendation";
import { generateRecommendation } from "@/lib/ai";
import { aiErrorMessage } from "@/lib/ai-error";
import { useCanUseAI, useEntitlementStore } from "@/lib/entitlement-store";
import { useFirstRunAiTry } from "@/lib/first-run-ai-try";
import { FREE_AI_LIMIT } from "@/lib/plans";
import { useStore } from "@/lib/store";
import type { SEOAnalysis } from "@/types/seo";

interface FirstRunAiTryProps {
  analysis: SEOAnalysis;
}

/**
 * The one-time prompt after a fresh install's first analysis (#80). One click
 * sends the same hosted title request as the "AI Suggested Title" box in the
 * Meta Tags breakdown, counted against the free monthly allowance like any
 * other. Free tier only; dismissing it hides it for good.
 */
export function FirstRunAiTry({ analysis }: FirstRunAiTryProps) {
  const settings = useStore((s) => s.settings);
  const showToast = useStore((s) => s.showToast);
  const entitlementLoaded = useEntitlementStore((s) => s.entitlementLoaded);
  const isPro = useEntitlementStore((s) => s.isPro);
  const freeAiLimit = useEntitlementStore((s) => s.freeAiLimit);
  const aiDisabled = !useCanUseAI();
  const offeredFor = useFirstRunAiTry((s) => s.offeredFor);
  const suggestion = useFirstRunAiTry((s) => s.suggestion);
  const offerAfterAnalysis = useFirstRunAiTry((s) => s.offerAfterAnalysis);
  const setSuggestion = useFirstRunAiTry((s) => s.setSuggestion);
  const dismiss = useFirstRunAiTry((s) => s.dismiss);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wait for the entitlement so a Pro install is never mistaken for free.
  useEffect(() => {
    if (entitlementLoaded) void offerAfterAnalysis(analysis.timestamp);
  }, [entitlementLoaded, analysis.timestamp, offerAfterAnalysis]);

  if (offeredFor !== analysis.timestamp || isPro) return null;

  // Built the same way as the options the Meta Tags breakdown passes.
  const advancedOptions = {
    ...(settings.advancedMode
      ? {
          pageType: settings.pageType,
          secondaryKeywords: settings.secondaryKeywords,
        }
      : {}),
    languageCode: settings.language,
  };

  const suggestTitle = async () => {
    const text = await generateRecommendation(
      "title-keyword",
      analysis.keyword,
      analysis.pageData.title,
      advancedOptions,
    );
    setSuggestion(text);
    return text;
  };

  const handleTry = async () => {
    setLoading(true);
    setError(null);
    try {
      await suggestTitle();
    } catch (err) {
      const message = aiErrorMessage(err, "Could not generate a suggestion");
      showToast(message);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      aria-label="Try an AI suggestion"
      className="mb-3 animate-fade-in rounded-card-lg border border-border bg-surface p-4 shadow-card"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent/15">
          <Sparkles className="h-4 w-4 text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-body-semibold text-ink">
            Try one AI suggestion for this page&apos;s title
          </h3>
          <p className="mt-0.5 text-body-12 text-muted">
            Powered by Claude (Anthropic). Uses one of your {freeAiLimit ?? FREE_AI_LIMIT} free AI
            recommendations this month.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="-mr-1 -mt-1 rounded-full p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {suggestion === null ? (
        <div className="mt-3 flex flex-col gap-2 pl-12">
          <Button
            size="small"
            className="self-start"
            onClick={handleTry}
            loading={loading}
            disabled={aiDisabled}
          >
            Suggest a title
          </Button>
          {error && (
            <p role="alert" className="text-body-12 text-poor">
              {error}
            </p>
          )}
        </div>
      ) : (
        <EditableRecommendation
          className="mt-3"
          label="AI Suggested Title"
          initialValue={suggestion}
          onRegenerate={suggestTitle}
          onToast={showToast}
          aiDisabled={aiDisabled}
        />
      )}
    </section>
  );
}
