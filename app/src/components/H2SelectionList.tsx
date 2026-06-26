import { useState, useCallback, useEffect, useRef } from "react";
import { Copy, RefreshCw, Check, Sparkles } from "lucide-react";
import { Button } from "./ui/Button";
import { cn } from "@/lib/utils";

interface H2Item {
  index: number;
  text: string;
  suggestion: string;
}

interface H2SelectionListProps {
  items: H2Item[];
  onRegenerateOne: (index: number, h2Text: string) => Promise<string>;
  onRegenerateAll: () => Promise<string[]>;
  onToast: (message: string) => void;
  apiKeyMissing?: boolean;
  className?: string;
}

export function H2SelectionList({
  items,
  onRegenerateOne,
  onRegenerateAll,
  onToast,
  apiKeyMissing = false,
  className,
}: H2SelectionListProps) {
  const [suggestions, setSuggestions] = useState<Record<number, string>>(() => {
    const map: Record<number, string> = {};
    for (const item of items) {
      if (item.suggestion) map[item.index] = item.suggestion;
    }
    return map;
  });
  const textareaRefs = useRef<Map<number, HTMLTextAreaElement>>(new Map());

  // Sync suggestions when items change (e.g., when AI suggestions complete)
  useEffect(() => {
    const newMap: Record<number, string> = {};
    for (const item of items) {
      if (item.suggestion) newMap[item.index] = item.suggestion;
    }
    setSuggestions((prev) => {
      // Only update if there are new suggestions from props
      const hasNewSuggestions = items.some(
        (item) => item.suggestion && item.suggestion !== prev[item.index]
      );
      return hasNewSuggestions ? { ...prev, ...newMap } : prev;
    });
  }, [items]);

  // Auto-resize a specific textarea
  const adjustHeight = useCallback((index: number) => {
    const textarea = textareaRefs.current.get(index);
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, []);

  // Adjust all textarea heights when suggestions change
  useEffect(() => {
    for (const index of Object.keys(suggestions).map(Number)) {
      adjustHeight(index);
    }
  }, [suggestions, adjustHeight]);
  const [loadingItems, setLoadingItems] = useState<Set<number>>(new Set());
  const [copiedItems, setCopiedItems] = useState<Set<number>>(new Set());
  const [loadingAll, setLoadingAll] = useState(false);

  const handleRegenerateOne = useCallback(
    async (index: number, h2Text: string) => {
      setLoadingItems((prev) => new Set(prev).add(index));
      try {
        const result = await onRegenerateOne(index, h2Text);
        setSuggestions((prev) => ({ ...prev, [index]: result }));
        onToast("H2 suggestion regenerated");
      } catch {
        onToast("Failed to regenerate");
      } finally {
        setLoadingItems((prev) => {
          const next = new Set(prev);
          next.delete(index);
          return next;
        });
      }
    },
    [onRegenerateOne, onToast],
  );

  const handleRegenerateAll = useCallback(async () => {
    setLoadingAll(true);
    try {
      const results = await onRegenerateAll();
      const newSuggestions: Record<number, string> = {};
      items.forEach((item, i) => {
        newSuggestions[item.index] = results[i] ?? "";
      });
      setSuggestions(newSuggestions);
      onToast("All H2 suggestions generated");
    } catch {
      onToast("Failed to generate suggestions");
    } finally {
      setLoadingAll(false);
    }
  }, [items, onRegenerateAll, onToast]);

  const handleCopy = useCallback(
    async (index: number) => {
      const text = suggestions[index];
      if (!text) return;
      await navigator.clipboard.writeText(text);
      setCopiedItems((prev) => new Set(prev).add(index));
      onToast("Copied to clipboard");
      setTimeout(() => {
        setCopiedItems((prev) => {
          const next = new Set(prev);
          next.delete(index);
          return next;
        });
      }, 2000);
    },
    [suggestions, onToast],
  );

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between">
        <span className="text-body-12 uppercase tracking-wider text-muted">
          H2 Heading Suggestions
        </span>
        <Button
          size="small"
          variant="secondary"
          onClick={handleRegenerateAll}
          loading={loadingAll}
          disabled={apiKeyMissing}
          title={apiKeyMissing ? "Set up API key in options" : undefined}
        >
          <Sparkles className="h-3 w-3" />
          Generate All
        </Button>
      </div>

      {apiKeyMissing && (
        <p className="text-body-12 text-muted opacity-70">
          Set up your OpenAI API key in options to use AI suggestions.
        </p>
      )}

      {items.map((item) => {
        const suggestion = suggestions[item.index] ?? "";
        const isLoading = loadingItems.has(item.index);
        const isCopied = copiedItems.has(item.index);

        return (
          <div key={item.index} className="rounded-card bg-surface-2 p-3">
            <div className="mb-1.5 text-body-12 text-muted">
              <span className="font-medium text-ink">H2 #{item.index + 1}:</span>{" "}
              {item.text}
            </div>
            <div className="flex gap-2">
              <textarea
                ref={(el) => {
                  if (el) textareaRefs.current.set(item.index, el);
                }}
                value={suggestion}
                onChange={(e) => {
                  setSuggestions((prev) => ({ ...prev, [item.index]: e.target.value }));
                  adjustHeight(item.index);
                }}
                placeholder="Click regenerate to get a suggestion..."
                rows={1}
                className="flex-1 rounded-input bg-surface px-3 py-2 text-body-12 text-ink placeholder:text-faint outline-none focus:ring-1 focus:ring-brand transition-shadow resize-none overflow-hidden"
              />
              <div className="flex items-start gap-1">
                <button
                  onClick={() => handleCopy(item.index)}
                  disabled={!suggestion}
                  className={cn(
                    "rounded-full p-1.5 transition-colors disabled:opacity-30",
                    isCopied
                      ? "bg-good/15 text-good"
                      : "text-muted hover:bg-surface-2 hover:text-ink",
                  )}
                  title="Copy"
                >
                  {isCopied ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  onClick={() => handleRegenerateOne(item.index, item.text)}
                  disabled={isLoading || apiKeyMissing}
                  className="rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-ink transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted"
                  title={apiKeyMissing ? "Set up API key in options" : "Regenerate"}
                >
                  <RefreshCw
                    className={cn("h-3.5 w-3.5", isLoading && "animate-spin")}
                  />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
