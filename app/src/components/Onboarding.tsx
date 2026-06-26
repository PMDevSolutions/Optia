import { useState, useEffect } from "react";
import { X, Search, Sparkles, BarChart3 } from "lucide-react";
import { getStorageItem, setStorageItem } from "@/lib/storage";
import { Button } from "./ui/Button";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="relative w-full max-w-sm rounded-card bg-bg-700 p-6">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 rounded-full p-1.5 text-text-secondary hover:bg-bg-500 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="text-center">
          <h2 className="text-h2 text-text-primary mb-2">Optia</h2>
          <p className="text-body-16 text-text-secondary mb-6">
            Instant SEO scores with plain-language fixes
          </p>
        </div>

        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-blue/20 flex-shrink-0">
              <Search className="h-4 w-4 text-accent-blue" />
            </div>
            <div>
              <h3 className="text-body-16 font-medium text-text-primary">18 SEO Checks</h3>
              <p className="text-body-12 text-text-secondary">
                Comprehensive analysis across meta, content, links, images, and technical SEO
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green/20 flex-shrink-0">
              <Sparkles className="h-4 w-4 text-green" />
            </div>
            <div>
              <h3 className="text-body-16 font-medium text-text-primary">AI Recommendations</h3>
              <p className="text-body-12 text-text-secondary">
                Get optimized titles, descriptions, H2 headings, and alt text powered by AI
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow/20 flex-shrink-0">
              <BarChart3 className="h-4 w-4 text-yellow" />
            </div>
            <div>
              <h3 className="text-body-16 font-medium text-text-primary">Schema Templates</h3>
              <p className="text-body-12 text-text-secondary">
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
