import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { SUPPORTED_LANGUAGES } from "@/lib/languages";
import { OptiaWordmark } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useEntitlementStore } from "@/lib/entitlement-store";

function LicenseCard() {
  const isPro = useEntitlementStore((state) => state.isPro);
  const expiresAt = useEntitlementStore((state) => state.expiresAt);
  const aiQuotaRemaining = useEntitlementStore((state) => state.aiQuotaRemaining);
  const quotaLimit = useEntitlementStore((state) => state.quotaLimit);
  const activating = useEntitlementStore((state) => state.activating);
  const activationError = useEntitlementStore((state) => state.activationError);
  const activateLicense = useEntitlementStore((state) => state.activateLicense);
  const deactivateLicense = useEntitlementStore((state) => state.deactivateLicense);
  const hydrateEntitlement = useEntitlementStore((state) => state.hydrateEntitlement);
  const [licenseKey, setLicenseKey] = useState("");
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    void hydrateEntitlement();
  }, [hydrateEntitlement]);

  const handleActivate = async () => {
    if (!licenseKey.trim() || activating) return;
    const ok = await activateLicense(licenseKey);
    if (ok) setLicenseKey("");
  };

  const handleDeactivate = async () => {
    setDeactivating(true);
    try {
      await deactivateLicense();
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <div className="mt-5 rounded-card-lg border border-border bg-surface p-6 shadow-card">
      <div className="flex items-center gap-2">
        <h2 className="text-h1 text-ink">License</h2>
        {isPro ? (
          <span className="rounded-pill bg-brand px-2.5 py-0.5 text-[12px] font-medium text-brand-fg">
            Pro
          </span>
        ) : (
          <span className="rounded-pill bg-surface-2 px-2.5 py-0.5 text-[12px] font-medium text-muted">
            Free
          </span>
        )}
      </div>

      {isPro ? (
        <div className="mt-1 flex flex-col gap-4">
          <p className="text-body text-muted">
            Optia Pro is active on this browser.
            {expiresAt && (
              <> Your entitlement auto-renews by {new Date(expiresAt).toLocaleDateString()}.</>
            )}
          </p>
          {quotaLimit > 0 && (
            <p className="text-body-12 text-muted">
              AI quota this month: {aiQuotaRemaining} of {quotaLimit} remaining.
            </p>
          )}
          <button
            onClick={handleDeactivate}
            disabled={deactivating}
            className="self-start rounded-pill border border-border bg-surface px-6 py-2.5 text-button text-ink transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deactivating ? "Deactivating..." : "Deactivate on this browser"}
          </button>
        </div>
      ) : (
        <div className="mt-1 flex flex-col gap-4">
          <p className="text-body text-muted">
            Enter your Optia Pro license key to unlock AI without an Anthropic key and advanced
            analysis.
          </p>
          <div className="flex flex-col gap-2">
            <label htmlFor="license-key" className="text-body-semibold text-ink">
              License key
            </label>
            <input
              id="license-key"
              type="text"
              placeholder="optia_live_..."
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              className="rounded-input border border-border bg-surface px-3.5 py-3 text-body text-ink shadow-card placeholder:text-faint outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </div>
          {activationError && (
            <p role="alert" className="text-body text-poor">
              {activationError}
            </p>
          )}
          <button
            onClick={handleActivate}
            disabled={activating || !licenseKey.trim()}
            className="self-start rounded-pill bg-brand px-6 py-2.5 text-button text-brand-fg shadow-brand transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {activating ? "Activating..." : "Activate"}
          </button>
        </div>
      )}
    </div>
  );
}

const languages = SUPPORTED_LANGUAGES.map((lang) => ({
  value: lang.code,
  label: `${lang.code.toUpperCase()} - ${lang.name}`,
}));

export function Options() {
  const canBringOwnKey = useEntitlementStore((s) => s.canBringOwnKey);
  const canUseMultiLanguage = useEntitlementStore((s) => s.canUseMultiLanguage);
  const hydrateEntitlement = useEntitlementStore((s) => s.hydrateEntitlement);
  const [apiKey, setApiKey] = useState("");
  const [language, setLanguage] = useState("en");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void hydrateEntitlement();
    chrome.storage.local
      .get(["anthropic_api_key", "default_language"])
      .then((result) => {
        if (result.anthropic_api_key) setApiKey(result.anthropic_api_key);
        if (result.default_language) setLanguage(result.default_language);
      });
  }, [hydrateEntitlement]);

  // Multi-language is a Pro feature — free users are pinned to English.
  const effectiveLanguage = canUseMultiLanguage ? language : "en";

  const handleSave = async () => {
    const toStore: Record<string, string> = { default_language: effectiveLanguage };
    // BYO key is Pro-only; never persist a key for a free user.
    if (canBringOwnKey) toStore.anthropic_api_key = apiKey;
    await chrome.storage.local.set(toStore);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-md p-6">
        <div className="mb-5 flex items-center justify-between">
          <OptiaWordmark />
          <ThemeToggle />
        </div>

        <div className="rounded-card-lg border border-border bg-surface p-6 shadow-card">
          <h1 className="text-h1 text-ink">Settings</h1>
          <p className="mb-5 mt-1 text-body text-muted">
            Free users get AI recommendations through Optia's hosted service. Activate Pro to bring
            your own Anthropic key and unlock multi-language output.
          </p>

          <div className="flex flex-col gap-5">
            {canBringOwnKey ? (
              <div className="flex flex-col gap-2">
                <label htmlFor="api-key" className="text-body-semibold text-ink">
                  Anthropic API key
                </label>
                <input
                  id="api-key"
                  type="password"
                  placeholder="sk-ant-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="rounded-input border border-border bg-surface px-3.5 py-3 text-body text-ink shadow-card placeholder:text-faint outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30"
                />
                <p className="text-body-12 text-faint">
                  Stored locally in your browser — only ever sent directly to Anthropic.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-body-semibold text-ink">Anthropic API key</span>
                  <span className="rounded-pill bg-brand px-2 py-0.5 text-[11px] font-medium text-brand-fg">
                    Pro
                  </span>
                </div>
                <p className="text-body-12 text-muted">
                  Bring your own Anthropic key with Optia Pro for unlimited, uncapped AI.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <label htmlFor="default-language" className="text-body-semibold text-ink">
                  Default language
                </label>
                {!canUseMultiLanguage && (
                  <span className="rounded-pill bg-brand px-2 py-0.5 text-[11px] font-medium text-brand-fg">
                    Pro
                  </span>
                )}
              </div>
              <div className="relative">
                <select
                  id="default-language"
                  value={effectiveLanguage}
                  disabled={!canUseMultiLanguage}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full appearance-none rounded-input border border-border bg-surface px-3.5 py-3 pr-10 text-body text-ink shadow-card outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {languages.map((lang) => (
                    <option key={lang.value} value={lang.value}>
                      {lang.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
              </div>
              {!canUseMultiLanguage && (
                <p className="text-body-12 text-muted">
                  Multi-language AI output is an Optia Pro feature.
                </p>
              )}
            </div>

            <button
              onClick={handleSave}
              className="self-start rounded-pill bg-brand px-6 py-2.5 text-button text-brand-fg shadow-brand transition-colors hover:bg-brand-hover"
            >
              Save
            </button>

            {saved && <p className="text-body-semibold text-good">Settings saved.</p>}
          </div>
        </div>

        <LicenseCard />
      </div>
    </div>
  );
}
