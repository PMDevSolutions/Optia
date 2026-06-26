import { useState, useCallback } from "react";
import { ChevronDown, ChevronUp, Copy, Check, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SchemaRecommendation } from "@/types/seo";

interface SchemaDisplayProps {
  schemas: SchemaRecommendation[];
  onToast: (message: string) => void;
  className?: string;
}

export function SchemaDisplay({ schemas, onToast, className }: SchemaDisplayProps) {
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set());
  const [copiedSchemas, setCopiedSchemas] = useState<Set<string>>(new Set());

  const toggleSchema = useCallback((name: string) => {
    setExpandedSchemas((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const handleCopy = useCallback(
    async (name: string, code: string) => {
      const wrapped = `<script type="application/ld+json">\n${code}\n</script>`;
      await navigator.clipboard.writeText(wrapped);
      setCopiedSchemas((prev) => new Set(prev).add(name));
      onToast("Schema copied to clipboard");
      setTimeout(() => {
        setCopiedSchemas((prev) => {
          const next = new Set(prev);
          next.delete(name);
          return next;
        });
      }, 2000);
    },
    [onToast],
  );

  if (schemas.length === 0) return null;

  const required = schemas.filter((s) => s.isRequired);
  const optional = schemas.filter((s) => !s.isRequired);

  const renderSupportBadge = (support: string, note?: string) => {
    const colors =
      support === "yes"
        ? "bg-good/15 text-good"
        : support === "partial"
          ? "bg-warn/15 text-warn"
          : "bg-surface-3/20 text-muted";
    const label =
      support === "yes"
        ? "Rich Results"
        : support === "partial"
          ? "Partial"
          : "Descriptive Only";
    return (
      <span
        className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium", colors)}
        title={note}
      >
        {label}
      </span>
    );
  };

  const renderSchemaCard = (schema: SchemaRecommendation) => {
    const isExpanded = expandedSchemas.has(schema.name);
    const isCopied = copiedSchemas.has(schema.name);

    return (
      <div key={schema.name} className="overflow-hidden rounded-card border border-border bg-surface">
        <button
          onClick={() => toggleSchema(schema.name)}
          className="flex w-full items-center justify-between p-3 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-body-16 font-medium text-ink">{schema.name}</span>
            {renderSupportBadge(schema.googleSupport, schema.googleSupportNote)}
          </div>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted" />
          )}
        </button>
        {isExpanded && (
          <div className="border-t border-border px-3 pb-3 pt-2">
            <p className="text-body-12 text-muted mb-2">{schema.description}</p>
            <div className="relative overflow-x-auto rounded-input border border-border bg-surface-2 p-3">
              <pre className="text-body-12 text-ink whitespace-pre-wrap">
                <code>{schema.jsonLdCode}</code>
              </pre>
              <button
                onClick={() => handleCopy(schema.name, schema.jsonLdCode)}
                className={cn(
                  "absolute top-2 right-2 rounded-full p-1.5 transition-colors",
                  isCopied
                    ? "bg-good/15 text-good"
                    : "text-muted hover:bg-surface-2 hover:text-ink",
                )}
                title="Copy JSON-LD"
              >
                {isCopied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <a
              href={schema.documentationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-body-12 text-brand hover:underline"
            >
              Documentation <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <span className="text-body-12 uppercase tracking-wider text-muted">
        Recommended Schema Markup
      </span>

      {required.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-body-12 font-medium text-good">Required</span>
          {required.map(renderSchemaCard)}
        </div>
      )}

      {optional.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-body-12 font-medium text-muted">Optional</span>
          {optional.map(renderSchemaCard)}
        </div>
      )}
    </div>
  );
}
