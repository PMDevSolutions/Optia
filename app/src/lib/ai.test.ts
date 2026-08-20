import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateRecommendation,
  generateH2Suggestion,
  generateAllH2Suggestions,
  generateAltText,
  AiUnavailableError,
  type AdvancedOptions,
} from "@/lib/ai";
import {
  generateRecommendationDirect,
  generateH2SuggestionDirect,
  generateAltTextDirect,
} from "@/lib/anthropic";
import { generateViaProxy, AiProxyError } from "@/lib/ai-proxy";
import { aiStatusNow, useEntitlementStore, type AiStatus } from "@/lib/entitlement-store";
import { useStore } from "@/lib/store";

// The AI facade only routes; the three access paths (direct SDK, hosted proxy)
// and the entitlement gate are all mocked so these tests assert *dispatch* —
// which downstream fn is called, with what args — not the generation itself.
vi.mock("@/lib/anthropic", () => ({
  generateRecommendationDirect: vi.fn(),
  generateH2SuggestionDirect: vi.fn(),
  generateAltTextDirect: vi.fn(),
}));

// Keep the real AiProxyError class (ai.ts does `err instanceof AiProxyError`);
// only the network call is mocked.
vi.mock("@/lib/ai-proxy", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/ai-proxy")>();
  return { ...original, generateViaProxy: vi.fn() };
});

// Keep the real store instance (so applyProxyQuota can be swapped via setState)
// but take control of the entitlement decision by mocking aiStatusNow.
vi.mock("@/lib/entitlement-store", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/entitlement-store")>();
  return { ...original, aiStatusNow: vi.fn() };
});

const generateRecommendationDirectMock = vi.mocked(generateRecommendationDirect);
const generateH2SuggestionDirectMock = vi.mocked(generateH2SuggestionDirect);
const generateAltTextDirectMock = vi.mocked(generateAltTextDirect);
const generateViaProxyMock = vi.mocked(generateViaProxy);
const aiStatusNowMock = vi.mocked(aiStatusNow);

const TEST_KEY = "sk-ant-test-key";
const testQuota = { period: "2026-07", remaining: 42, limit: 100 };
const advancedOptions: AdvancedOptions = {
  pageType: "product-page",
  secondaryKeywords: "seo, ranking",
  languageCode: "fr",
};

// applyProxyQuota is a store action; we swap it for a spy each test so we can
// assert the recorded (quota, subject) without touching real storage.
let applyProxyQuotaMock: ReturnType<typeof vi.fn>;
let showToastMock: ReturnType<typeof vi.fn>;

function setMode(mode: AiStatus["mode"]): void {
  aiStatusNowMock.mockReturnValue({ mode, remaining: null, limit: null });
}

/** An Anthropic SDK-shaped rejection (duck-typed on .status, like completeWithRetry). */
function anthropicError(status: number): Error {
  return Object.assign(new Error(`${status} error`), { status });
}

beforeEach(() => {
  applyProxyQuotaMock = vi.fn().mockResolvedValue(undefined);
  showToastMock = vi.fn();
  useEntitlementStore.setState({ applyProxyQuota: applyProxyQuotaMock });
  useStore.setState({ apiKey: "", useOwnKey: true, apiKeyInvalid: false, showToast: showToastMock });

  generateRecommendationDirectMock.mockResolvedValue("direct recommendation");
  generateH2SuggestionDirectMock.mockResolvedValue("direct h2");
  generateAltTextDirectMock.mockResolvedValue("direct alt");
  // The proxy reports the subject it actually metered against; mirror the
  // request's `authenticated` flag (a Pro user in these tests has a token).
  generateViaProxyMock.mockImplementation(async (req) => ({
    recommendation: "proxy recommendation",
    model: "claude-opus-4-8",
    quota: testQuota,
    authenticated: req.authenticated,
  }));
});

describe("generateRecommendation", () => {
  it("byok → calls the Direct fn with the stored key + advancedOptions, never the proxy", async () => {
    setMode("byok");
    useStore.setState({ apiKey: TEST_KEY });
    generateRecommendationDirectMock.mockResolvedValue("byok rec");

    const result = await generateRecommendation("title-keyword", "kw", "current title", advancedOptions);

    expect(result).toBe("byok rec");
    expect(generateRecommendationDirectMock).toHaveBeenCalledWith(
      TEST_KEY,
      "title-keyword",
      "kw",
      "current title",
      advancedOptions,
    );
    expect(generateViaProxyMock).not.toHaveBeenCalled();
    expect(applyProxyQuotaMock).not.toHaveBeenCalled();
  });

  it("pro → routes to the proxy authenticated, records the quota as 'pro', returns the recommendation", async () => {
    setMode("pro");

    const result = await generateRecommendation("title-keyword", "kw", "current title", advancedOptions);

    expect(result).toBe("proxy recommendation");
    expect(generateViaProxyMock).toHaveBeenCalledWith({
      checkId: "title-keyword",
      keyword: "kw",
      context: "current title",
      authenticated: true,
    });
    // advancedOptions are a BYO-key enhancement and must NOT reach the proxy.
    expect(generateViaProxyMock).toHaveBeenCalledTimes(1);
    expect(generateViaProxyMock.mock.calls[0][0]).not.toHaveProperty("advancedOptions");
    expect(applyProxyQuotaMock).toHaveBeenCalledWith(testQuota, "pro");
    expect(generateRecommendationDirectMock).not.toHaveBeenCalled();
  });

  it("free → routes to the proxy unauthenticated and records the quota as 'free'", async () => {
    setMode("free");

    const result = await generateRecommendation("meta-description-keyword", "kw", "desc");

    expect(result).toBe("proxy recommendation");
    expect(generateViaProxyMock).toHaveBeenCalledWith({
      checkId: "meta-description-keyword",
      keyword: "kw",
      context: "desc",
      authenticated: false,
    });
    expect(applyProxyQuotaMock).toHaveBeenCalledWith(testQuota, "free");
    expect(generateRecommendationDirectMock).not.toHaveBeenCalled();
  });

  it("locked → throws AiUnavailableError and calls nothing downstream", async () => {
    setMode("locked");

    const error = await generateRecommendation("title-keyword", "kw", "ctx").then(
      () => null,
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(AiUnavailableError);
    expect((error as Error).name).toBe("AiUnavailableError");
    expect(generateRecommendationDirectMock).not.toHaveBeenCalled();
    expect(generateViaProxyMock).not.toHaveBeenCalled();
    expect(applyProxyQuotaMock).not.toHaveBeenCalled();
  });

  it("free → a server quota_exceeded drives cached remaining to 0 and re-throws", async () => {
    setMode("free");
    useEntitlementStore.setState({ freeAiLimit: 10 });
    generateViaProxyMock.mockRejectedValue(new AiProxyError("quota_exceeded", "quota reached"));

    const error = await generateRecommendation("title-keyword", "kw", "ctx").then(
      () => null,
      (e: unknown) => e,
    );

    // Re-thrown so the UI surfaces the friendly message...
    expect(error).toBeInstanceOf(AiProxyError);
    // ...and the cache is driven to 0 so the gate converges to locked/upsell.
    expect(applyProxyQuotaMock).toHaveBeenCalledWith(
      expect.objectContaining({ remaining: 0, limit: 10 }),
      "free",
    );
  });

  it("pro → records against the subject the proxy actually metered (free if no token)", async () => {
    setMode("pro");
    // A Pro request whose token was missing is install-metered by the server.
    generateViaProxyMock.mockResolvedValue({
      recommendation: "r",
      model: "m",
      quota: testQuota,
      authenticated: false,
    });

    await generateRecommendation("title-keyword", "kw", "ctx");

    expect(applyProxyQuotaMock).toHaveBeenCalledWith(testQuota, "free");
  });
});

describe("byok fallback on a rejected key", () => {
  it("401 from the direct path → flags the key invalid, toasts once, and falls back to the proxy as Pro", async () => {
    setMode("byok");
    useStore.setState({ apiKey: TEST_KEY });
    generateRecommendationDirectMock.mockRejectedValue(anthropicError(401));

    const result = await generateRecommendation("title-keyword", "kw", "ctx");

    expect(result).toBe("proxy recommendation");
    expect(useStore.getState().apiKeyInvalid).toBe(true);
    expect(showToastMock).toHaveBeenCalledTimes(1);
    expect(showToastMock.mock.calls[0][0]).toMatch(/key was rejected/i);
    expect(generateViaProxyMock).toHaveBeenCalledWith({
      checkId: "title-keyword",
      keyword: "kw",
      context: "ctx",
      authenticated: true,
    });
    expect(applyProxyQuotaMock).toHaveBeenCalledWith(testQuota, "pro");
  });

  it("403 falls back the same way for H2 and alt-text with their proxy checkIds", async () => {
    setMode("byok");
    useStore.setState({ apiKey: TEST_KEY });
    generateH2SuggestionDirectMock.mockRejectedValue(anthropicError(403));

    const result = await generateH2Suggestion("Heading", "kw");

    expect(result).toBe("proxy recommendation");
    expect(generateViaProxyMock).toHaveBeenCalledWith({
      checkId: "h2-keyword",
      keyword: "kw",
      context: "Heading",
      authenticated: true,
    });
  });

  it("concurrent failures toast and flag only once", async () => {
    setMode("byok");
    useStore.setState({ apiKey: TEST_KEY });
    generateH2SuggestionDirectMock.mockRejectedValue(anthropicError(401));

    await generateAllH2Suggestions(["A", "B", "C"], "kw");

    expect(showToastMock).toHaveBeenCalledTimes(1);
    expect(generateViaProxyMock).toHaveBeenCalledTimes(3);
  });

  it("non-auth errors rethrow unchanged with no fallback and no flag", async () => {
    setMode("byok");
    useStore.setState({ apiKey: TEST_KEY });
    generateRecommendationDirectMock.mockRejectedValue(anthropicError(500));

    const error = await generateRecommendation("title-keyword", "kw", "ctx").then(
      () => null,
      (e: unknown) => e,
    );

    expect((error as { status?: number }).status).toBe(500);
    expect(useStore.getState().apiKeyInvalid).toBe(false);
    expect(showToastMock).not.toHaveBeenCalled();
    expect(generateViaProxyMock).not.toHaveBeenCalled();
  });

  it("401 with Pro quota already exhausted → AiUnavailableError naming both problems, proxy untouched", async () => {
    // byok on entry; locked once the invalid key degrades the mode.
    aiStatusNowMock
      .mockReturnValueOnce({ mode: "byok", remaining: null, limit: null })
      .mockReturnValue({ mode: "locked", remaining: 0, limit: 100 });
    useStore.setState({ apiKey: TEST_KEY });
    generateRecommendationDirectMock.mockRejectedValue(anthropicError(401));

    const error = await generateRecommendation("title-keyword", "kw", "ctx").then(
      () => null,
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(AiUnavailableError);
    expect((error as Error).message).toMatch(/rejected/i);
    expect((error as Error).message).toMatch(/quota is used up/i);
    expect(useStore.getState().apiKeyInvalid).toBe(true);
    expect(generateViaProxyMock).not.toHaveBeenCalled();
  });
});

describe("lockedError copy", () => {
  beforeEach(() => {
    setMode("locked");
  });

  async function lockedMessage(): Promise<string> {
    const error = await generateRecommendation("title-keyword", "kw", "ctx").then(
      () => null,
      (e: unknown) => e,
    );
    return (error as Error).message;
  }

  it("free → upgrade prompt", async () => {
    useEntitlementStore.setState({ isPro: false });
    expect(await lockedMessage()).toMatch(/upgrade to optia pro/i);
  });

  it("pro without a key → suggests adding a key", async () => {
    useEntitlementStore.setState({ isPro: true });
    expect(await lockedMessage()).toMatch(/add your own anthropic key/i);
  });

  it("pro with a key but toggle off → suggests turning the toggle on", async () => {
    useEntitlementStore.setState({ isPro: true });
    useStore.setState({ apiKey: TEST_KEY, useOwnKey: false });
    expect(await lockedMessage()).toMatch(/turn on 'use my anthropic key'/i);
  });

  it("pro with a rejected key → suggests updating the key", async () => {
    useEntitlementStore.setState({ isPro: true });
    useStore.setState({ apiKey: TEST_KEY, apiKeyInvalid: true });
    expect(await lockedMessage()).toMatch(/key was rejected/i);
  });
});

describe("generateH2Suggestion", () => {
  it("byok → calls generateH2SuggestionDirect with the key, h2 text, keyword, and advancedOptions", async () => {
    setMode("byok");
    useStore.setState({ apiKey: TEST_KEY });
    generateH2SuggestionDirectMock.mockResolvedValue("byok h2");

    const result = await generateH2Suggestion("Current Heading", "kw", advancedOptions);

    expect(result).toBe("byok h2");
    expect(generateH2SuggestionDirectMock).toHaveBeenCalledWith(
      TEST_KEY,
      "Current Heading",
      "kw",
      advancedOptions,
    );
    expect(generateViaProxyMock).not.toHaveBeenCalled();
  });

  it("proxy path → maps to checkId 'h2-keyword' with the h2 text as context", async () => {
    setMode("pro");

    const result = await generateH2Suggestion("Current Heading", "kw", advancedOptions);

    expect(result).toBe("proxy recommendation");
    expect(generateViaProxyMock).toHaveBeenCalledWith({
      checkId: "h2-keyword",
      keyword: "kw",
      context: "Current Heading",
      authenticated: true,
    });
    expect(applyProxyQuotaMock).toHaveBeenCalledWith(testQuota, "pro");
  });

  it("locked → throws AiUnavailableError", async () => {
    setMode("locked");

    const error = await generateH2Suggestion("Heading", "kw").then(
      () => null,
      (e: unknown) => e,
    );

    expect((error as Error).name).toBe("AiUnavailableError");
    expect(generateH2SuggestionDirectMock).not.toHaveBeenCalled();
    expect(generateViaProxyMock).not.toHaveBeenCalled();
  });
});

describe("generateAllH2Suggestions", () => {
  it("byok → returns an array, one Direct-generated suggestion per input heading", async () => {
    setMode("byok");
    useStore.setState({ apiKey: TEST_KEY });
    generateH2SuggestionDirectMock.mockImplementation(async (_key, h2Text) => `optimized: ${h2Text}`);

    const result = await generateAllH2Suggestions(["Intro", "Features", "Pricing"], "kw", advancedOptions);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual(["optimized: Intro", "optimized: Features", "optimized: Pricing"]);
    expect(generateH2SuggestionDirectMock).toHaveBeenCalledTimes(3);
    expect(generateH2SuggestionDirectMock).toHaveBeenNthCalledWith(1, TEST_KEY, "Intro", "kw", advancedOptions);
  });

  it("proxy path → returns an array and records quota once per heading", async () => {
    setMode("free");

    const result = await generateAllH2Suggestions(["A", "B"], "kw");

    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual(["proxy recommendation", "proxy recommendation"]);
    expect(generateViaProxyMock).toHaveBeenCalledTimes(2);
    expect(applyProxyQuotaMock).toHaveBeenCalledTimes(2);
    expect(applyProxyQuotaMock).toHaveBeenLastCalledWith(testQuota, "free");
  });

  it("returns an empty array when given no headings (never routes)", async () => {
    setMode("free");

    const result = await generateAllH2Suggestions([], "kw");

    expect(result).toEqual([]);
    expect(generateViaProxyMock).not.toHaveBeenCalled();
    expect(generateH2SuggestionDirectMock).not.toHaveBeenCalled();
  });
});

describe("generateAltText", () => {
  it("byok → calls generateAltTextDirect with the key, image src, keyword, and advancedOptions", async () => {
    setMode("byok");
    useStore.setState({ apiKey: TEST_KEY });
    generateAltTextDirectMock.mockResolvedValue("byok alt");

    const result = await generateAltText("https://cdn.example.com/pic.png", "kw", advancedOptions);

    expect(result).toBe("byok alt");
    expect(generateAltTextDirectMock).toHaveBeenCalledWith(
      TEST_KEY,
      "https://cdn.example.com/pic.png",
      "kw",
      advancedOptions,
    );
    expect(generateViaProxyMock).not.toHaveBeenCalled();
  });

  it("proxy path → maps to checkId 'images-alt' with the image src as context", async () => {
    setMode("free");

    const result = await generateAltText("https://cdn.example.com/pic.png", "kw");

    expect(result).toBe("proxy recommendation");
    expect(generateViaProxyMock).toHaveBeenCalledWith({
      checkId: "images-alt",
      keyword: "kw",
      context: "https://cdn.example.com/pic.png",
      authenticated: false,
    });
    expect(applyProxyQuotaMock).toHaveBeenCalledWith(testQuota, "free");
  });

  it("locked → throws AiUnavailableError", async () => {
    setMode("locked");

    const error = await generateAltText("https://cdn.example.com/pic.png", "kw").then(
      () => null,
      (e: unknown) => e,
    );

    expect((error as Error).name).toBe("AiUnavailableError");
    expect(generateAltTextDirectMock).not.toHaveBeenCalled();
    expect(generateViaProxyMock).not.toHaveBeenCalled();
  });
});
