import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CategoryScore } from "@/types/seo";

interface SummaryCardProps {
  category: CategoryScore;
  onClick: () => void;
  className?: string;
}

function getStatusBadgeClass(passed: number, total: number): string {
  if (passed === total) return "status-badge-success";
  if (passed === 0) return "status-badge-error";
  return "status-badge-warning";
}

function getArrowCircleClass(passed: number, total: number): string {
  if (passed === total) return "arrow-circle-success";
  if (passed === 0) return "arrow-circle-error";
  return "arrow-circle-warning";
}

function TriangleUp({ className }: { className?: string }) {
  return (
    <svg width="13" height="11" viewBox="0 0 16 14" fill="none" className={className}>
      <path d="M8 0L15.7942 14H0.205771L8 0Z" fill="currentColor" />
    </svg>
  );
}

function TriangleDown({ className }: { className?: string }) {
  return (
    <svg width="13" height="11" viewBox="0 0 16 14" fill="none" className={className}>
      <path d="M8 14L0.205771 0H15.7942L8 14Z" fill="currentColor" />
    </svg>
  );
}

export function SummaryCard({ category, onClick, className }: SummaryCardProps) {
  const statusBadgeClass = getStatusBadgeClass(category.passed, category.total);
  const arrowCircleClass = getArrowCircleClass(category.passed, category.total);

  return (
    <button
      onClick={onClick}
      className={cn(
        "summarybox-card group w-full text-left transition-all hover:border-border-strong hover:shadow-pop",
        className,
      )}
    >
      {/* Header Row */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-h2 text-ink">{category.label}</span>
        <div className="flex items-center gap-2">
          <span className={statusBadgeClass}>
            {category.passed}/{category.total} passed
          </span>
          <div className={cn(arrowCircleClass, "transition-transform group-hover:translate-x-0.5")}>
            <ArrowUpRight className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Individual Check Items */}
      <div className="flex flex-col gap-2">
        {category.checks.map((check) => (
          <div key={check.id} className="flex items-center gap-2">
            {check.status === "pass" ? (
              <TriangleUp className="flex-shrink-0 text-good" />
            ) : (
              <TriangleDown className="flex-shrink-0 text-poor" />
            )}
            <span className="text-body text-muted">{check.title}</span>
          </div>
        ))}
      </div>
    </button>
  );
}
