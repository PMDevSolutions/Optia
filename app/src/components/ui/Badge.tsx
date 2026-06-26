import { cn } from "@/lib/utils";
import type { CheckStatus, CheckPriority } from "@/types/seo";

interface BadgeProps {
  status: CheckStatus;
  priority?: CheckPriority;
  className?: string;
}

export function Badge({ status, priority, className }: BadgeProps) {
  const label =
    status === "pass"
      ? "Passed"
      : priority === "high"
        ? "High Priority"
        : priority === "medium"
          ? "Medium"
          : "Low Priority";

  const isError = status === "fail" && priority === "high";
  const isWarning = status === "warning" || (status === "fail" && priority !== "high");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill border px-2.5 py-1 text-[12px] font-semibold leading-none whitespace-nowrap",
        status === "pass" && "border-good/25 bg-good-tint text-good",
        isError && "border-poor/25 bg-poor-tint text-poor",
        isWarning && "border-warn/30 bg-warn-tint text-warn",
        className,
      )}
    >
      {label}
    </span>
  );
}
