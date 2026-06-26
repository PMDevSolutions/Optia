import { useState, useEffect } from "react";
import { X, Search, Sparkles, BarChart3 } from "lucide-react";
import { getStorageItem, setStorageItem } from "@/lib/storage";
import { Button } from "./ui/Button";
import { OptiaMark } from "./ui/Logo";

export function Onboarding() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    getStorageItem<boolean>("onboarding_dismissed").then((dismissed) => {
      if (!dismissed) setVisible(true);
    });
  }, []);

  const handleDismiss = async () => {
    setVisible(false);
    await setStorageItem("onboarding_dismissed", true);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-sm animate-scale-in rounded-card-lg border border-border bg-surface p-6 shadow-pop">
        <button
          onClick={handleDismiss}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-full p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-6 flex flex-col items-center text-center">
          <OptiaMark size={44} />
          <h2 className="mt-3 text-h1 text-ink">Optia</h2>
          <p className="mt-1 text-body text-muted">
            Instant SEO scores with plain-language fixes
          </p>
        </div>

        <div className="mb-6 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand/15">
              <Search className="h-4 w-4 text-brand" />
            </div>
            <div>
              <h3 className="text-body-semibold text-ink">18 SEO Checks</h3>
              <p className="text-body-12 text-muted">
                Comprehensive analysis across meta, content, links, images, and technical SEO
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent/15">
              <Sparkles className="h-4 w-4 text-accent" />
            </div>
            <div>
              <h3 className="text-body-semibold text-ink">AI Recommendations</h3>
              <p className="text-body-12 text-muted">
                Get optimized titles, descriptions, H2 headings, and alt text powered by AI
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-good/15">
              <BarChart3 className="h-4 w-4 text-good" />
            </div>
            <div>
              <h3 className="text-body-semibold text-ink">Schema Templates</h3>
              <p className="text-body-12 text-muted">
                JSON-LD templates for 16 page types with copy-to-clipboard
              </p>
            </div>
          </div>
        </div>

        <Button onClick={handleDismiss} className="w-full" showArrow>
          Get Started
        </Button>
      </div>
    </div>
  );
}
