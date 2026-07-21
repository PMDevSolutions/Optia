import { useState, useCallback } from "react";
import { Copy, RefreshCw, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecommendationBoxProps {
  label: string;
  value: string;
  onRegenerate: () => Promise<string>;
  onToast: (message: string) => void;
  aiDisabled?: boolean;
  className?: string;
}

export function RecommendationBox({
  label,
  value,
  onRegenerate,
  onToast,
  aiDisabled = false,
  className,
}: RecommendationBoxProps) {
  const [text, setText] = useState(value);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    onToast("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }, [text, onToast]);

  const handleRegenerate = useCallback(async () => {
    setLoading(true);
    try {
      const newText = await onRegenerate();
      setText(newText);
      onToast("Recommendation regenerated");
    } catch {
      onToast("Failed to regenerate");
    } finally {
      setLoading(false);
    }
  }, [onRegenerate, onToast]);

  return (
    <div className={cn("rounded-card border border-border bg-surface-2 p-4", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-label uppercase text-muted">{label}</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            title="Copy"
            aria-label="Copy"
            className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-2.5 py-1 text-[12px] font-semibold text-ink transition-colors hover:border-brand hover:text-brand"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-good" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={handleRegenerate}
            disabled={loading || aiDisabled}
            className="rounded-full p-1.5 text-muted transition-colors hover:bg-surface-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-muted"
            title={aiDisabled ? "Activate Optia Pro or add your own Anthropic key in options" : "Regenerate"}
            aria-label="Regenerate"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
        </div>
      </div>
      <p className="text-body text-ink">{text}</p>
      {aiDisabled && (
        <p className="mt-2 text-body-12 text-faint">
          Activate Optia Pro or add your own Anthropic key in options to use AI suggestions.
        </p>
      )}
    </div>
  );
}
