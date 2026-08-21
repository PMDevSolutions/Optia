import { useStore } from "@/lib/store";
import { aiStatusNow, useEntitlementStore } from "@/lib/entitlement-store";
import { currentAiPeriod } from "@/lib/entitlement";
import {
  generateRecommendationDirect,
  generateH2SuggestionDirect,
  generateAltTextDirect,
  type AdvancedOptions,
} from "@/lib/anthropic";
import { generateViaProxy, AiProxyError } from "@/lib/ai-proxy";

export type { AdvancedOptions };

// AI facade: routes each generation to the right path based on entitlement.
//   byok  → direct browser→Anthropic call with the user's key (advanced context applies)
//   pro   → hosted proxy authenticated by entitlement (higher monthly cap)
//   free  → hosted proxy metered by install id (capped monthly allowance)
//   locked → no path available → AiUnavailableError (surface a friendly upsell)
//
// The proxy accepts only { checkId, keyword, context }; advanced options are a
// BYO-key enhancement and are not forwarded to it.

export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

/** Locked-state message tailored to the tier so it never dead-ends the user. */
function lockedError(): AiUnavailableError {
  const isPro = useEntitlementStore.getState().isPro;
  if (!isPro) {
    return new AiUnavailableError(
      "You've used your free AI recommendations for this month. Upgrade to Optia Pro for more.",
    );
  }
  const { apiKey, useOwnKey, apiKeyInvalid } = useStore.getState();
  if (apiKeyInvalid) {
    return new AiUnavailableError(
      "You've reached your monthly AI limit and your Anthropic key was rejected. Update your key in settings for unlimited AI.",
    );
  }
  if (apiKey && !useOwnKey) {
    return new AiUnavailableError(
      "You've reached your monthly AI limit. Turn on 'Use my Anthropic key' in settings for unlimited AI.",
    );
  }
  return new AiUnavailableError(
    "You've reached your monthly AI limit. Add your own Anthropic key in options for unlimited AI.",
  );
}

/** Anthropic rejected the credential (same duck-typing as completeWithRetry). */
function isAuthError(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  return status === 401 || status === 403;
}

/**
 * Runs a BYOK direct call; if Anthropic rejects the key (401/403), flags the key
 * invalid (so computeAiStatus degrades byok → pro for later calls), surfaces one
 * toast, and gracefully falls back to the hosted proxy for this request.
 */
async function runDirectWithFallback(
  direct: () => Promise<string>,
  proxy: () => Promise<string>,
): Promise<string> {
  try {
    return await direct();
  } catch (err) {
    if (!isAuthError(err)) throw err;
    const store = useStore.getState();
    if (!store.apiKeyInvalid) {
      // Guard: generate-all runs concurrently — flag and toast only once.
      store.setApiKeyInvalid(true);
      store.showToast(
        "Your Anthropic API key was rejected — using Optia's hosted AI instead. Check your key in settings.",
      );
    }
    if (aiStatusNow().mode === "locked") {
      throw new AiUnavailableError(
        "Your Anthropic API key was rejected and your monthly Optia AI quota is used up. Update your key in settings.",
      );
    }
    return proxy();
  }
}

async function runProxy(
  checkId: string,
  keyword: string,
  context: string,
  authenticated: boolean,
): Promise<string> {
  try {
    const result = await generateViaProxy({ checkId, keyword, context, authenticated });
    // Record against the subject the server actually metered (a Pro request with
    // no token falls back to install metering).
    await useEntitlementStore
      .getState()
      .applyProxyQuota(result.quota, result.authenticated ? "pro" : "free");
    return result.recommendation;
  } catch (err) {
    // The server is the quota authority: on a quota rejection, drive the cached
    // remaining to 0 so the UI converges to the locked/upsell state instead of
    // looping on error toasts with the controls still enabled.
    if (err instanceof AiProxyError && err.code === "quota_exceeded") {
      const state = useEntitlementStore.getState();
      const subject = authenticated ? "pro" : "free";
      const limit = subject === "pro" ? state.quotaLimit : (state.freeAiLimit ?? 0);
      await state.applyProxyQuota({ period: currentAiPeriod(), remaining: 0, limit }, subject);
    }
    throw err;
  }
}

export async function generateRecommendation(
  checkId: string,
  keyword: string,
  context: string,
  advancedOptions?: AdvancedOptions,
): Promise<string> {
  const status = aiStatusNow();
  if (status.mode === "locked") throw lockedError();
  if (status.mode === "byok") {
    return runDirectWithFallback(
      () =>
        generateRecommendationDirect(
          useStore.getState().apiKey,
          checkId,
          keyword,
          context,
          advancedOptions,
        ),
      () => runProxy(checkId, keyword, context, true),
    );
  }
  return runProxy(checkId, keyword, context, status.mode === "pro");
}

export async function generateH2Suggestion(
  h2Text: string,
  keyword: string,
  advancedOptions?: AdvancedOptions,
): Promise<string> {
  const status = aiStatusNow();
  if (status.mode === "locked") throw lockedError();
  if (status.mode === "byok") {
    return runDirectWithFallback(
      () => generateH2SuggestionDirect(useStore.getState().apiKey, h2Text, keyword, advancedOptions),
      () => runProxy("h2-keyword", keyword, h2Text, true),
    );
  }
  return runProxy("h2-keyword", keyword, h2Text, status.mode === "pro");
}

/**
 * Generates suggestions for every H2 independently. Quota is spent per request,
 * so one upstream failure must not discard the suggestions that succeeded —
 * failed slots come back as null for per-item retry. Throws only when every
 * generation failed (preserving the locked/upsell error for the toast).
 */
export async function generateAllH2Suggestions(
  h2Texts: string[],
  keyword: string,
  advancedOptions?: AdvancedOptions,
): Promise<(string | null)[]> {
  const settled = await Promise.allSettled(
    h2Texts.map((text) => generateH2Suggestion(text, keyword, advancedOptions)),
  );
  if (settled.length > 0 && settled.every((r) => r.status === "rejected")) {
    throw (settled[0] as PromiseRejectedResult).reason;
  }
  return settled.map((r) => (r.status === "fulfilled" ? r.value : null));
}

export async function generateAltText(
  imageSrc: string,
  keyword: string,
  advancedOptions?: AdvancedOptions,
): Promise<string> {
  const status = aiStatusNow();
  if (status.mode === "locked") throw lockedError();
  if (status.mode === "byok") {
    return runDirectWithFallback(
      () => generateAltTextDirect(useStore.getState().apiKey, imageSrc, keyword, advancedOptions),
      () => runProxy("images-alt", keyword, imageSrc, true),
    );
  }
  return runProxy("images-alt", keyword, imageSrc, status.mode === "pro");
}
