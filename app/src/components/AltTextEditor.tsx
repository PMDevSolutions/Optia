import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "./ui/Button";
import { cn } from "@/lib/utils";

interface AltTextEditorProps {
  imageSrc: string;
  currentAlt: string;
  onGenerate: (src: string) => Promise<string>;
  onToast: (message: string) => void;
  className?: string;
}

export function AltTextEditor({
  imageSrc,
  currentAlt,
  onGenerate,
  onToast,
  className,
}: AltTextEditorProps) {
  const [alt, setAlt] = useState(currentAlt);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const generated = await onGenerate(imageSrc);
      setAlt(generated);
      onToast("Alt text generated");
    } catch {
      onToast("Failed to generate alt text");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("flex gap-3 rounded-card bg-surface p-3", className)}>
      <img
        src={imageSrc}
        alt={alt || "Page image"}
        className="h-16 w-16 rounded-input object-cover bg-surface-2 flex-shrink-0"
      />
      <div className="flex flex-1 flex-col gap-2">
        <input
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          placeholder="Enter alt text..."
          className="w-full rounded-input bg-surface-2 px-3 py-2 text-body-12 text-ink placeholder:text-faint outline-none focus:ring-1 focus:ring-brand"
        />
        <div className="flex gap-2">
          <Button size="small" variant="secondary" onClick={handleGenerate} loading={loading}>
            <Sparkles className="h-3 w-3" />
            AI Generate
          </Button>
        </div>
      </div>
    </div>
  );
}
