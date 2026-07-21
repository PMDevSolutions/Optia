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
  return new AiUnavailableError(
    isPro
      ? "You've reached your monthly AI limit. Add your own Anthropic key in options for unlimited AI."
      : "You've used your free AI recommendations for this month. Upgrade to Optia Pro for more.",
  );
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
    return generateRecommendationDirect(
      useStore.getState().apiKey,
      checkId,
      keyword,
      context,
      advancedOptions,
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
    return generateH2SuggestionDirect(useStore.getState().apiKey, h2Text, keyword, advancedOptions);
  }
  return runProxy("h2-keyword", keyword, h2Text, status.mode === "pro");
}

export async function generateAllH2Suggestions(
  h2Texts: string[],
  keyword: string,
  advancedOptions?: AdvancedOptions,
): Promise<string[]> {
  return Promise.all(h2Texts.map((text) => generateH2Suggestion(text, keyword, advancedOptions)));
}

export async function generateAltText(
  imageSrc: string,
  keyword: string,
  advancedOptions?: AdvancedOptions,
): Promise<string> {
  const status = aiStatusNow();
  if (status.mode === "locked") throw lockedError();
  if (status.mode === "byok") {
    return generateAltTextDirect(useStore.getState().apiKey, imageSrc, keyword, advancedOptions);
  }
  return runProxy("images-alt", keyword, imageSrc, status.mode === "pro");
}
