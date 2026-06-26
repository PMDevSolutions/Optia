import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { OptiaWordmark } from "@/components/ui/Logo";
import { Footer } from "@/components/Footer";
import { useStore } from "@/lib/store";
import { SUPPORTED_LANGUAGES } from "@/lib/languages";
import { getKeywordForUrl, getAdvancedOptions } from "@/lib/storage";
import { Settings, X } from "lucide-react";

const pageTypes = [
  { value: "homepage", label: "Homepage" },
  { value: "category-page", label: "Category Page" },
  { value: "product-page", label: "Product Page" },
  { value: "product-software", label: "Product Software" },
  { value: "blog-post", label: "Blog Post" },
  { value: "landing-page", label: "Landing Page" },
  { value: "contact-page", label: "Contact Page" },
  { value: "about-page", label: "About Page" },
  { value: "service-page", label: "Service Page" },
  { value: "portfolio-page", label: "Portfolio Page" },
  { value: "testimonial-page", label: "Testimonial Page" },
  { value: "location-page", label: "Location Page" },
  { value: "legal-page", label: "Legal Page" },
  { value: "event-page", label: "Event Page" },
  { value: "press-page", label: "Press/News Page" },
  { value: "job-page", label: "Job/Career Page" },
];

const languages = SUPPORTED_LANGUAGES.map((lang) => ({
  value: lang.code,
  label: `${lang.code.toUpperCase()} - ${lang.name}`,
}));

interface SetupPageProps {
  onAnalyze: () => void;
}

const isDevMode =
  typeof chrome === "undefined" || chrome.tabs === undefined;

/**
 * Hook that watches an input element for programmatic value changes
 * (autofill, paste tools, browser automation) and syncs back to React state.
 */
function useProgrammaticInputSync(
  onValueChange: (value: string) => void,
) {
  const ref = useRef<HTMLInputElement>(null);
  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;

  useEffect(() => {
    const input = ref.current;
    if (!input) return;

    const nativeDescriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    );
    if (!nativeDescriptor || !nativeDescriptor.set) return;

    const nativeSetter = nativeDescriptor.set;

    Object.defineProperty(input, "value", {
      configurable: true,
      get() {
        return nativeDescriptor.get?.call(this) ?? "";
      },
      set(newValue: string) {
        nativeSetter.call(this, newValue);
        onValueChangeRef.current(newValue);
      },
    });

    return () => {
      delete (input as unknown as Record<string, unknown>).value;
    };
  }, []);

  return ref;
}

export function SetupPage({ onAnalyze }: SetupPageProps) {
  const { settings, setSettings, apiKey, setApiKey, error } = useStore();
  const [showSettings, setShowSettings] = useState(false);
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
    setLocalApiKey(apiKey);
  }, [apiKey]);

  const handleSaveSettings = async () => {
    await setApiKey(localApiKey);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  const keywordRef = useProgrammaticInputSync((value) =>
    setSettings({ keyword: value }),
  );

  const urlRef = useProgrammaticInputSync((value) =>
    setSettings({ targetUrl: value }),
  );

  const handleUrlBlur = useCallback(async () => {
    const url = settings.targetUrl.trim();
    if (!url) return;
    try {
      const savedKeyword = await getKeywordForUrl(url);
      if (savedKeyword && !settings.keyword) {
        setSettings({ keyword: savedKeyword });
      }
      const host = new URL(url).hostname;
      const savedOptions = await getAdvancedOptions(host);
      if (savedOptions) {
        setSettings({
          pageType: savedOptions.pageType,
          secondaryKeywords: savedOptions.secondaryKeywords,
          language: savedOptions.language,
          advancedMode: true,
        });
      }
    } catch {
      // Invalid URL — ignore
    }
  }, [settings.targetUrl, settings.keyword, setSettings]);

  const canAnalyze =
    settings.keyword.trim() !== "" &&
    (!isDevMode || settings.targetUrl.trim() !== "");

  const secondaryKeywordsLength = settings.secondaryKeywords.length;

  return (
    <div className="flex min-h-screen flex-col bg-canvas p-3">
      {/* App header */}
      <header className="mb-3 flex items-center justify-between">
        <OptiaWordmark />
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label="Settings"
          >
            <Settings className="h-[18px] w-[18px]" />
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* Inline settings panel */}
      {showSettings && (
        <div className="mb-3 flex animate-fade-in flex-col gap-4 rounded-card-lg border border-border bg-surface p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-h2 text-ink">Settings</span>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="rounded-full p-1 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
              aria-label="Close settings"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="settings-api-key" className="text-body-semibold text-ink">
              OpenAI API key
            </label>
            <input
              id="settings-api-key"
              type="password"
              placeholder="sk-..."
              value={localApiKey}
              onChange={(e) => setLocalApiKey(e.target.value)}
              className="w-full rounded-input border border-border bg-surface px-3.5 py-2.5 text-body text-ink placeholder:text-faint outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </div>

          <Select
            label="AI recommendations language"
            options={languages}
            value={settings.language}
            onChange={(e) => setSettings({ language: e.target.value })}
          />

          <button
            type="button"
            onClick={handleSaveSettings}
            className="self-start rounded-pill bg-brand px-5 py-2 text-button text-brand-fg shadow-brand transition-colors hover:bg-brand-hover"
          >
            Save
          </button>

          {settingsSaved && <p className="text-body-semibold text-good">Settings saved.</p>}
        </div>
      )}

      {/* Main card */}
      <div className="flex w-full flex-col gap-6 rounded-card-lg border border-border bg-surface px-5 py-6 shadow-card">
        <h1 className="text-center text-h1 text-ink">Set up your SEO analysis</h1>

        {/* Dev mode URL field */}
        {isDevMode && (
          <Input
            ref={urlRef}
            label="Page URL to analyze"
            type="url"
            placeholder="https://example.com"
            value={settings.targetUrl}
            onChange={(e) => setSettings({ targetUrl: e.target.value })}
            onBlur={handleUrlBlur}
          />
        )}

        {/* Main keyword */}
        <Input
          ref={keywordRef}
          label="Main keyword"
          placeholder="Enter your main keyword"
          value={settings.keyword}
          onChange={(e) => setSettings({ keyword: e.target.value })}
        />

        {/* Divider */}
        <div className="h-px w-full bg-border" />

        {/* Advanced Analysis section */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-h2 text-ink">Advanced Analysis</span>
            <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">
              optional
            </span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <p className="text-body text-muted">
              Get smarter, page-specific recommendations based on your page context.
            </p>
            <Toggle
              checked={settings.advancedMode}
              onChange={(checked) => setSettings({ advancedMode: checked })}
            />
          </div>
        </div>

        {/* Advanced fields */}
        {settings.advancedMode && (
          <>
            <Select
              label="Page type"
              options={pageTypes}
              value={settings.pageType}
              onChange={(e) => setSettings({ pageType: e.target.value })}
            />

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="text-h2 text-ink">Secondary keywords</span>
                <span className="text-body-12 text-muted">
                  ({secondaryKeywordsLength}/2000 characters)
                </span>
              </div>
              <textarea
                id="secondary-keywords"
                placeholder="SEO Webflow, Search engine optimization..."
                value={settings.secondaryKeywords}
                onChange={(e) => {
                  if (e.target.value.length <= 2000) {
                    setSettings({ secondaryKeywords: e.target.value });
                  }
                }}
                rows={3}
                className="w-full resize-none rounded-input border border-border bg-surface px-3.5 py-3 text-body text-ink shadow-card placeholder:text-faint outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30"
              />
              <p className="text-body-12 text-muted">
                Add related or synonym keywords to help AI deliver richer SEO recommendations.
              </p>
            </div>
          </>
        )}

        {/* Error message */}
        {error && (
          <div className="rounded-input border border-poor/30 bg-poor-tint px-4 py-3 text-body text-poor">
            {error}
          </div>
        )}

        {/* Primary action */}
        <div className="flex justify-center">
          <Button onClick={onAnalyze} disabled={!canAnalyze} showArrow>
            Optimize my SEO
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto w-full pt-3">
        <Footer />
      </div>
    </div>
  );
}
