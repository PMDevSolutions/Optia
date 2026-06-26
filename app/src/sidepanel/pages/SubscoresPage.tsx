import { useCallback, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { CheckItem } from "@/components/CheckItem";
import { EditableRecommendation } from "@/components/EditableRecommendation";
import { H2SelectionList } from "@/components/H2SelectionList";
import { ImageAltTextList } from "@/components/ImageAltTextList";
import { SchemaDisplay } from "@/components/SchemaDisplay";
import { Toast } from "@/components/ui/Toast";
import { Footer } from "@/components/Footer";
import { useStore } from "@/lib/store";
import {
  generateRecommendation,
  generateH2Suggestion,
  generateAllH2Suggestions,
  generateAltText,
} from "@/lib/openai";
import { getSchemaRecommendations } from "@/lib/schema-recommendations";
import type { SEOCheck } from "@/types/seo";

// Triangle icons for summary pill
function TriangleUpIcon({ className }: { className?: string }) {
  return (
    <svg width="13" height="11" viewBox="0 0 14 12" fill="none" className={className}>
      <path d="M7 0L13.9282 12H0.0717969L7 0Z" fill="currentColor" />
    </svg>
  );
}

function TriangleDownIcon({ className }: { className?: string }) {
  return (
    <svg width="13" height="11" viewBox="0 0 14 12" fill="none" className={className}>
      <path d="M7 12L0.0717969 0H13.9282L7 12Z" fill="currentColor" />
    </svg>
  );
}

const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

function sortByPriority(checks: SEOCheck[]): SEOCheck[] {
  return [...checks].sort((a, b) => {
    const aPass = a.status === "pass" ? 1 : 0;
    const bPass = b.status === "pass" ? 1 : 0;
    if (aPass !== bPass) return aPass - bPass;
    return (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
  });
}

export function SubscoresPage() {
  const { analysis, activeCategory, setActiveCategory, apiKey, settings, toast, showToast, hideToast } =
    useStore();

  // Scroll to top when entering this page
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeCategory]);

  const onToast = useCallback((message: string) => showToast(message), [showToast]);

  if (!analysis || !activeCategory) return null;

  const category = analysis.categories.find(
    (c) => c.category === activeCategory,
  );
  if (!category) return null;

  const failed = category.total - category.passed;
  const keyword = analysis.keyword;
  const sortedChecks = sortByPriority(category.checks);
  const noApiKey = !apiKey;

  const advancedOptions = settings.advancedMode
    ? {
        pageType: settings.pageType,
        secondaryKeywords: settings.secondaryKeywords,
        languageCode: settings.language,
      }
    : undefined;

  const rejectNoKey = () => Promise.reject(new Error("No API key configured"));

  const renderCheckRecommendation = (check: SEOCheck) => {
    if (check.status === "pass") return null;

    if (check.id === "h2-keyword" && check.h2Recommendations) {
      return (
        <div className="mt-3">
          <H2SelectionList
            items={check.h2Recommendations}
            onRegenerateOne={
              noApiKey
                ? rejectNoKey
                : (_index, h2Text) =>
                    generateH2Suggestion(apiKey, h2Text, keyword, advancedOptions)
            }
            onRegenerateAll={
              noApiKey
                ? () => rejectNoKey() as Promise<string[]>
                : () =>
                    generateAllH2Suggestions(
                      apiKey,
                      check.h2Recommendations!.map((h) => h.text),
                      keyword,
                      advancedOptions,
                    )
            }
            onToast={onToast}
            apiKeyMissing={noApiKey}
          />
        </div>
      );
    }

    if (check.id === "images-alt" && check.imageData && check.imageData.length > 0) {
      return (
        <div className="mt-3">
          <ImageAltTextList
            images={check.imageData}
            onGenerate={
              noApiKey
                ? rejectNoKey
                : (src) => generateAltText(apiKey, src, keyword, advancedOptions)
            }
            onToast={onToast}
            apiKeyMissing={noApiKey}
          />
        </div>
      );
    }

    if (check.id === "schema-markup") {
      const schemas = getSchemaRecommendations(settings.pageType);
      if (schemas.length > 0) {
        return (
          <div className="mt-3">
            <SchemaDisplay schemas={schemas} onToast={onToast} />
          </div>
        );
      }
    }

    if (check.copyable) {
      const context =
        check.id === "title-keyword"
          ? analysis.pageData.title
          : check.id === "meta-description-keyword"
            ? analysis.pageData.metaDescription
            : check.id === "keyword-url"
              ? analysis.pageData.url
              : check.id === "h1-keyword"
                ? analysis.pageData.h1[0] ?? ""
                : check.id === "keyword-intro"
                  ? analysis.pageData.paragraphs[0] ?? ""
                  : check.details ?? "";

      const label =
        check.id === "title-keyword"
          ? "AI Suggested Title"
          : check.id === "meta-description-keyword"
            ? "AI Suggested Meta Description"
            : check.id === "keyword-url"
              ? "AI Suggested URL Slug"
              : check.id === "h1-keyword"
                ? "AI Suggested H1"
                : check.id === "keyword-intro"
                  ? "AI Suggested Introduction"
                  : "AI Recommendation";

      return (
        <div className="mt-3">
          <EditableRecommendation
            label={label}
            initialValue={check.recommendation ?? "Click regenerate to generate..."}
            onRegenerate={
              noApiKey
                ? rejectNoKey
                : () =>
                    generateRecommendation(apiKey, check.id, keyword, context, advancedOptions)
            }
            onToast={onToast}
            apiKeyMissing={noApiKey}
          />
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas p-3">
      {/* Main card */}
      <div className="flex flex-col gap-6 rounded-card-lg border border-border bg-surface px-5 py-6 shadow-card">
        {/* Header: back arrow + centered title */}
        <div className="relative flex items-center justify-center">
          <button
            onClick={() => setActiveCategory(null)}
            aria-label="Back"
            className="absolute left-0 inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-center text-h1 text-ink">{category.label}</h1>
        </div>

        {/* Summary pill */}
        <div className="flex justify-center">
          <div className="summary-pill">
            <span className="flex items-center gap-2 text-ink">
              <TriangleUpIcon className="text-good" />
              <span className="text-body-semibold">{category.passed} passed</span>
            </span>
            <span className="flex items-center gap-2 text-ink">
              <TriangleDownIcon className="text-poor" />
              <span className="text-body-semibold">{failed} to improve</span>
            </span>
          </div>
        </div>

        {/* Check items — flat list with dividers */}
        <div className="flex flex-col">
          {sortedChecks.map((check) => (
            <CheckItem key={check.id} check={check}>
              {renderCheckRecommendation(check)}
            </CheckItem>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto w-full pt-3">
        <Footer />
      </div>

      <Toast
        message={toast.message}
        visible={toast.visible}
        onClose={hideToast}
      />
    </div>
  );
}
