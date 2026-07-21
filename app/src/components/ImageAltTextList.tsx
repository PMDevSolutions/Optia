import { useState, useCallback } from "react";
import { Copy, RefreshCw, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ImageData } from "@/types/seo";

interface ImageAltTextListProps {
  images: ImageData[];
  onGenerate: (imageSrc: string) => Promise<string>;
  onToast: (message: string) => void;
  aiDisabled?: boolean;
  className?: string;
}

export function ImageAltTextList({
  images,
  onGenerate,
  onToast,
  aiDisabled = false,
  className,
}: ImageAltTextListProps) {
  const [altTexts, setAltTexts] = useState<Record<number, string>>({});
  const [loadingItems, setLoadingItems] = useState<Set<number>>(new Set());
  const [copiedItems, setCopiedItems] = useState<Set<number>>(new Set());

  const handleGenerate = useCallback(
    async (index: number, src: string) => {
      setLoadingItems((prev) => new Set(prev).add(index));
      try {
        const result = await onGenerate(src);
        setAltTexts((prev) => ({ ...prev, [index]: result }));
        onToast("Alt text generated");
      } catch {
        onToast("Failed to generate alt text");
      } finally {
        setLoadingItems((prev) => {
          const next = new Set(prev);
          next.delete(index);
          return next;
        });
      }
    },
    [onGenerate, onToast],
  );

  const handleCopy = useCallback(
    async (index: number) => {
      const text = altTexts[index];
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
    [altTexts, onToast],
  );

  if (images.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <span className="text-body-12 uppercase tracking-wider text-muted">
        Images Missing Alt Text
      </span>

      {aiDisabled && (
        <p className="text-body-12 text-muted opacity-70">
          Add your OpenAI API key or activate Optia Pro in options to use AI suggestions.
        </p>
      )}

      {images.map((img, index) => {
        const altText = altTexts[index] ?? "";
        const isLoading = loadingItems.has(index);
        const isCopied = copiedItems.has(index);

        return (
          <div key={index} className="flex gap-3 rounded-card bg-surface-2 p-3">
            <img
              src={img.src}
              alt={altText || "Page image"}
              className="h-16 w-16 rounded-input object-cover bg-surface flex-shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <div className="flex flex-1 flex-col gap-2">
              <div className="text-body-12 text-muted truncate">
                {img.src.split("/").pop()?.split("?")[0] ?? img.src}
              </div>
              <div className="flex gap-2">
                <input
                  value={altText}
                  onChange={(e) =>
                    setAltTexts((prev) => ({ ...prev, [index]: e.target.value }))
                  }
                  placeholder="Generate or type alt text..."
                  className="flex-1 rounded-input bg-surface px-3 py-2 text-body-12 text-ink placeholder:text-faint outline-none focus:ring-1 focus:ring-brand"
                />
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleCopy(index)}
                    disabled={!altText}
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
                    onClick={() => handleGenerate(index, img.src)}
                    disabled={isLoading || aiDisabled}
                    className="rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-ink transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted"
                    title={aiDisabled ? "Add an OpenAI API key or activate Optia Pro in options" : "Generate alt text"}
                  >
                    {isLoading ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
