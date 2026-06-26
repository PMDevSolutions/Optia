import { useEffect, useRef } from "react";
import { ArrowLeft, AlertTriangle, Sparkles } from "lucide-react";
import confetti from "canvas-confetti";
import { ScoreGauge } from "@/components/ui/ScoreGauge";
import { SummaryCard } from "@/components/SummaryCard";
import { Footer } from "@/components/Footer";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { OptiaWordmark } from "@/components/ui/Logo";
import { useStore } from "@/lib/store";
import type { CheckCategory } from "@/types/seo";

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

export function ScorePage() {
  const { analysis, setActiveCategory, reset } = useStore();
  const confettiFired = useRef(false);

  useEffect(() => {
    if (analysis && analysis.overallScore === 100 && !confettiFired.current) {
      confettiFired.current = true;
      confetti({
        particleCount: 120,
        spread: 75,
        origin: { y: 0.6 },
        colors: ["#4F46E5", "#0EA5E9", "#16A34A"],
      });
    }
  }, [analysis]);

  if (!analysis) return null;

  const handleCategoryClick = (category: CheckCategory) => {
    setActiveCategory(category);
  };

  const isPerfect = analysis.overallScore === 100;

  return (
    <div className="flex min-h-screen flex-col bg-canvas p-3">
      {/* App header */}
      <header className="mb-3 flex items-center justify-between">
        <OptiaWordmark />
        <ThemeToggle />
      </header>

      {/* Back / new analysis */}
      <button
        onClick={reset}
        className="mb-3 inline-flex items-center gap-1.5 self-start rounded-pill border border-border bg-surface px-3 py-1.5 text-[13px] font-semibold text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        New Analysis
      </button>

      {/* JS-rendered / fetch warning banner */}
      {analysis.pageData.fetchWarnings &&
        analysis.pageData.fetchWarnings.length > 0 && (
          <div className="mb-3 flex items-start gap-3 rounded-card border border-warn/30 bg-warn-tint p-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-warn" />
            <div className="text-body-12 text-warn">
              {analysis.pageData.fetchWarnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
            </div>
          </div>
        )}

      {/* Score hero */}
      <div className="score-circle-card mb-3 flex flex-col items-center gap-5">
        <ScoreGauge score={analysis.overallScore} />
        <div className="text-center">
          <h2 className="text-h1 text-ink">{analysis.scoreLabel}</h2>
          <p className="mt-1 text-body text-muted">{analysis.scoreDescription}</p>
        </div>

        {isPerfect && (
          <div className="flex animate-fade-in items-center gap-2 rounded-pill border border-good/30 bg-good-tint px-4 py-1.5 text-body-semibold text-good">
            <Sparkles className="h-4 w-4" />
            Perfect score — every check passed!
          </div>
        )}

        {/* Passed / to-improve summary */}
        <div className="summary-pill">
          <span className="flex items-center gap-2 text-ink">
            <TriangleUpIcon className="text-good" />
            <span className="text-body-semibold">{analysis.totalPassed} passed</span>
          </span>
          <span className="flex items-center gap-2 text-ink">
            <TriangleDownIcon className="text-poor" />
            <span className="text-body-semibold">{analysis.totalFailed} to improve</span>
          </span>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="flex flex-col gap-3">
        {analysis.categories.map((cat) => (
          <SummaryCard
            key={cat.category}
            category={cat}
            onClick={() => handleCategoryClick(cat.category)}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="mt-auto w-full pt-3">
        <Footer />
      </div>
    </div>
  );
}
