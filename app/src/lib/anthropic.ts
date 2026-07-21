import Anthropic from "@anthropic-ai/sdk";
import { getLanguageByCode } from "./languages";

// Direct browser→Anthropic path for Pro users who bring their own key. The key
// never transits Optia's backend (that path is the hosted proxy in ai-proxy.ts).
// Free/entitlement-metered generation goes through the proxy instead.

// SEO snippet generation is short and latency-sensitive; Opus 4.8 is the default
// per Anthropic guidance. Change AI_MODEL if a cheaper tier is preferred.
export const AI_MODEL = "claude-opus-4-8";
const MAX_TOKENS = 1024;

const isDevMode =
  typeof window !== "undefined" && window.location?.hostname === "localhost";

function createClient(apiKey: string): Anthropic {
  return new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
    ...(isDevMode ? { baseURL: `${window.location.origin}/api/anthropic` } : {}),
  });
}

function extractText(message: Anthropic.Message): string {
  const block = message.content.find((b) => b.type === "text");
  const text = block && block.type === "text" ? block.text.trim() : "";
  // Strip wrapping quotes the model sometimes adds
  return text.replace(/^["']|["']$/g, "");
}

async function completeWithRetry(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxRetries = 2,
): Promise<string> {
  const client = createClient(apiKey);
  let retries = 0;

  while (retries <= maxRetries) {
    try {
      const message = await client.messages.create({
        model: AI_MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });
      return extractText(message);
    } catch (error: unknown) {
      // Auth/permission errors won't resolve on retry
      const status = (error as { status?: number }).status;
      if (status === 401 || status === 403) throw error;
      if (retries === maxRetries) throw error;
      retries++;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, retries)));
    }
  }
  throw new Error("Max retries exceeded");
}

export interface AdvancedOptions {
  pageType?: string;
  secondaryKeywords?: string;
  languageCode?: string;
}

function buildAdvancedContext(opts?: AdvancedOptions): string {
  if (!opts) return "";
  let ctx = "";
  if (opts.pageType || opts.secondaryKeywords) {
    ctx = "\n\nAdvanced Context:";
    if (opts.pageType) ctx += `\n- Page Type: ${opts.pageType}`;
    if (opts.secondaryKeywords) ctx += `\n- Secondary Keywords: ${opts.secondaryKeywords}`;
  }
  return ctx;
}

function buildLanguageInstruction(langCode?: string): string {
  if (!langCode || langCode === "en") return "";
  const lang = getLanguageByCode(langCode);
  if (!lang) return "";
  return `\n\nIMPORTANT: Generate all content in ${lang.name} (${lang.nativeName}). Provide recommendations entirely in this language.`;
}

/** Direct Anthropic generation for a single SEO check (BYO-key path). */
export async function generateRecommendationDirect(
  apiKey: string,
  checkId: string,
  keyword: string,
  context: string,
  advancedOptions?: AdvancedOptions,
): Promise<string> {
  const advCtx = buildAdvancedContext(advancedOptions);
  const langInst = buildLanguageInstruction(advancedOptions?.languageCode);
  const pageTypeStr = advancedOptions?.pageType
    ? ` for a ${advancedOptions.pageType.replace("-", " ")}`
    : "";

  const copyableSystem = `You are an SEO expert providing ready-to-use content.
Create a single, concise, and optimized piece of content that naturally incorporates the keyphrase.
Return ONLY the final content with no additional explanation, quotes, or formatting.
The content must be directly usable by copying and pasting.${advCtx ? " Consider the page type and additional context provided." : ""}${langInst}`;

  const advisorySystem = `You are an SEO expert providing actionable advice.
Provide a concise recommendation for improving this SEO issue.${advCtx ? " Consider the page type and additional context provided." : ""}${langInst}`;

  switch (checkId) {
    case "title-keyword":
      return completeWithRetry(apiKey, copyableSystem,
        `Create a perfect SEO title for the keyphrase "${keyword}".
Current title: ${context}${advCtx}
Requirements:
- 50-60 characters
- Naturally incorporate the keyphrase "${keyword}"
- Make it compelling and click-worthy${pageTypeStr}
Return ONLY the title text.`);

    case "meta-description-keyword":
      return completeWithRetry(apiKey, copyableSystem,
        `Create a perfect meta description for the keyphrase "${keyword}".
Current description: ${context}${advCtx}
Requirements:
- 120-155 characters
- Naturally incorporate the keyphrase "${keyword}"
- Make it compelling with a call to action${pageTypeStr}
Return ONLY the description text.`);

    case "keyword-url":
      return completeWithRetry(apiKey, copyableSystem,
        `Create an SEO-friendly URL slug for the keyphrase "${keyword}".
Current URL: ${context}${advCtx}
Requirements:
- Extract ONLY the page slug (the part after the last slash)
- Ignore protocol, domain name, and folder paths
- Use lowercase letters only
- Separate words with hyphens
- Include the main keyphrase naturally
- Keep it concise and readable
Return ONLY the page slug with no slashes, protocol, or domain.`);

    case "h1-keyword":
      return completeWithRetry(apiKey, copyableSystem,
        `Create a perfect H1 heading for the keyphrase "${keyword}".
Current H1: ${context}${advCtx}
Requirements:
- Must contain the exact keyphrase "${keyword}"
- Keep it engaging and readable
- Make it compelling${pageTypeStr}
Return ONLY the H1 heading text.`);

    case "keyword-intro":
      return completeWithRetry(apiKey, copyableSystem,
        `Rewrite this introduction to naturally include the keyphrase "${keyword}".
Current introduction: ${context}${advCtx}
Requirements:
- Maintain the original message and tone
- Naturally incorporate the keyphrase "${keyword}"
- 2-3 sentences maximum
- Make it engaging${pageTypeStr}
Return ONLY the rewritten introduction.`);

    default:
      return completeWithRetry(apiKey, advisorySystem,
        `Fix this SEO issue: "${checkId}" for keyphrase "${keyword}" if applicable.
Current status: ${context}${advCtx}
Provide concise but actionable advice in 2-3 sentences${pageTypeStr}.`);
  }
}

/** Direct Anthropic H2 heading generation (BYO-key path). */
export async function generateH2SuggestionDirect(
  apiKey: string,
  h2Text: string,
  keyword: string,
  advancedOptions?: AdvancedOptions,
): Promise<string> {
  const advCtx = buildAdvancedContext(advancedOptions);
  const langInst = buildLanguageInstruction(advancedOptions?.languageCode);
  const pageTypeStr = advancedOptions?.pageType
    ? ` for a ${advancedOptions.pageType.replace("-", " ")}`
    : "";

  return completeWithRetry(
    apiKey,
    `You are an SEO expert providing ready-to-use content.
Return ONLY the final H2 heading text with no explanation, quotes, or formatting.${langInst}`,
    `Create a perfect H2 heading for the keyphrase "${keyword}".
Current H2: "${h2Text}"${advCtx}
CRITICAL: The H2 heading must contain the exact word "${keyword}" literally in the text.
Requirements:
- Include the exact keyphrase "${keyword}" (not synonyms)
- Keep it engaging and readable (40-60 characters ideal)
- Make it compelling and relevant${pageTypeStr}
- Use title case capitalization
Return ONLY the H2 heading text.`,
  );
}

/** Direct Anthropic alt-text generation (BYO-key path). */
export async function generateAltTextDirect(
  apiKey: string,
  imageSrc: string,
  keyword: string,
  advancedOptions?: AdvancedOptions,
): Promise<string> {
  const advCtx = buildAdvancedContext(advancedOptions);
  const langInst = buildLanguageInstruction(advancedOptions?.languageCode);
  const filename = imageSrc.split("/").pop()?.split("?")[0] ?? "unknown";

  return completeWithRetry(
    apiKey,
    `You are an SEO and accessibility expert. Return ONLY the alt text string with no explanations, quotes, or formatting.${langInst}`,
    `Create a concise, descriptive alt tag for this image that naturally incorporates the keyphrase "${keyword}".
Image URL: ${imageSrc}
Image filename: ${filename}${advCtx}
Requirements:
- Under 125 characters
- Naturally incorporate the keyphrase "${keyword}"
- Describe what the image likely shows based on the filename and context
- Make it specific and descriptive
Return ONLY the alt text.`,
  );
}
