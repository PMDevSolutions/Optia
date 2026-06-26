import { cn } from "@/lib/utils";
import { Badge } from "./ui/Badge";
import type { SEOCheck } from "@/types/seo";

// Triangle icons matching the score page
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

interface CheckItemProps {
  check: SEOCheck;
  className?: string;
  children?: React.ReactNode;
}

export function CheckItem({ check, className, children }: CheckItemProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border py-5 last:border-b-0",
        className,
      )}
    >
      {/* Header row: icon + title + badge */}
      <div className="flex items-center gap-2.5">
        {check.status === "pass" ? (
          <TriangleUpIcon className="flex-shrink-0 text-good" />
        ) : (
          <TriangleDownIcon className="flex-shrink-0 text-poor" />
        )}
        <span className="text-h2 text-ink">{check.title}</span>
        <Badge status={check.status} priority={check.priority} />
      </div>

      {/* Details text + Learn More */}
      {check.details && (
        <p className="text-body text-muted">
          {check.details}
          {check.learnMoreUrl && (
            <>
              {"  "}
              <a
                href={check.learnMoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"
              >
                Learn More &#8599;
              </a>
            </>
          )}
        </p>
      )}

      {/* Recommendation content (AI suggestions, schema, etc.) */}
      {children}
    </div>
  );
}
