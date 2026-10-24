import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FirstRunAiTry } from "./FirstRunAiTry";
import { generateRecommendation } from "@/lib/ai";
import { AiProxyError } from "@/lib/ai-proxy";
import { useEntitlementStore } from "@/lib/entitlement-store";
import { FIRST_RUN_AI_TRY_KEY, useFirstRunAiTry } from "@/lib/first-run-ai-try";
import { getStorageItem } from "@/lib/storage";
import { useStore } from "@/lib/store";
import type { PageSEOData, SEOAnalysis } from "@/types/seo";

vi.mock("@/lib/ai", () => ({ generateRecommendation: vi.fn() }));

const generateRecommendationMock = vi.mocked(generateRecommendation);

const pageData: PageSEOData = {
  url: "https://example.com/tools",
  title: "Tools | Example",
  metaDescription: "",
  metaKeywords: "",
  canonical: "",
  h1: ["Tools"],
  h2: [],
  h3: [],
  h4: [],
  h5: [],
  h6: [],
  images: [],
  ogTags: {},
  twitterTags: {},
  wordCount: 300,
  internalLinks: 4,
  externalLinks: 1,
  lang: "en",
  paragraphs: [],
  resources: { js: [], css: [] },
  schemaMarkup: { types: [], count: 0 },
  ogImage: "",
  imageFileSizes: [],
  fetchWarnings: [],
};

function analysisAt(timestamp: number): SEOAnalysis {
  return {
    overallScore: 62,
    scoreLabel: "Fair",
    scoreDescription: "A solid start!",
    totalPassed: 10,
    totalFailed: 8,
    categories: [],
    pageData,
    keyword: "seo tools",
    timestamp,
  };
}

const FIRST = analysisAt(1_793_000_000_000);
const SECOND = analysisAt(1_793_000_060_000);

const prompt = () => screen.queryByRole("heading", { name: /try one ai suggestion for this page's title/i });

async function freshInstall() {
  await chrome.storage.local.set({ [FIRST_RUN_AI_TRY_KEY]: "pending" });
}

beforeEach(() => {
  useEntitlementStore.setState({
    entitlementLoaded: true,
    isPro: false,
    aiQuotaRemaining: 0,
    quotaLimit: 0,
    freeAiRemaining: null,
    freeAiLimit: null,
  });
  useStore.setState({
    apiKey: "",
    useOwnKey: true,
    apiKeyInvalid: false,
    toast: { visible: false, message: "" },
    settings: {
      keyword: "seo tools",
      secondaryKeywords: "",
      pageType: "homepage",
      language: "en",
      advancedMode: false,
      targetUrl: "",
    },
  });
  useFirstRunAiTry.setState({ offeredFor: null, suggestion: null });
  generateRecommendationMock.mockResolvedValue("Best SEO Tools for Small Sites | Example");
});

describe("FirstRunAiTry", () => {
  it("appears after a fresh install's first analysis, and only that once", async () => {
    await freshInstall();
    const { rerender, unmount } = render(<FirstRunAiTry analysis={FIRST} />);

    expect(await screen.findByRole("heading", { name: /try one ai suggestion/i })).toBeInTheDocument();
    expect(screen.getByText(/uses one of your 25 free ai recommendations this month/i)).toBeInTheDocument();
    expect(await getStorageItem(FIRST_RUN_AI_TRY_KEY)).toBe("done");

    // The next analysis gets no prompt, in this panel or a reopened one.
    rerender(<FirstRunAiTry analysis={SECOND} />);
    await waitFor(() => expect(prompt()).not.toBeInTheDocument());
    unmount();
    useFirstRunAiTry.setState({ offeredFor: null, suggestion: null });
    render(<FirstRunAiTry analysis={SECOND} />);
    await waitFor(() => expect(chrome.storage.local.get).toHaveBeenCalled());
    expect(prompt()).not.toBeInTheDocument();
  });

  it("never appears on an install that was past onboarding before this shipped", async () => {
    render(<FirstRunAiTry analysis={FIRST} />);

    await waitFor(() => expect(chrome.storage.local.get).toHaveBeenCalled());
    expect(prompt()).not.toBeInTheDocument();
  });

  it("never appears on Pro", async () => {
    await freshInstall();
    useEntitlementStore.setState({ isPro: true, aiQuotaRemaining: 1000, quotaLimit: 1000 });
    render(<FirstRunAiTry analysis={FIRST} />);

    await waitFor(async () => expect(await getStorageItem(FIRST_RUN_AI_TRY_KEY)).toBe("done"));
    expect(prompt()).not.toBeInTheDocument();
  });

  it("waits for the entitlement before deciding", async () => {
    await freshInstall();
    useEntitlementStore.setState({ entitlementLoaded: false });
    render(<FirstRunAiTry analysis={FIRST} />);

    expect(await getStorageItem(FIRST_RUN_AI_TRY_KEY)).toBe("pending");
    expect(prompt()).not.toBeInTheDocument();

    useEntitlementStore.setState({ entitlementLoaded: true });
    expect(await screen.findByRole("heading", { name: /try one ai suggestion/i })).toBeInTheDocument();
  });

  it("asks for the title suggestion the normal path does and shows it with a copy button", async () => {
    await freshInstall();
    const user = userEvent.setup();
    render(<FirstRunAiTry analysis={FIRST} />);

    await user.click(await screen.findByRole("button", { name: /suggest a title/i }));

    expect(generateRecommendationMock).toHaveBeenCalledTimes(1);
    expect(generateRecommendationMock).toHaveBeenCalledWith(
      "title-keyword",
      "seo tools",
      "Tools | Example",
      { languageCode: "en" },
    );
    expect(await screen.findByDisplayValue("Best SEO Tools for Small Sites | Example")).toBeInTheDocument();
    expect(screen.getByText(/ai suggested title/i)).toBeInTheDocument();
    expect(screen.getByTitle(/copy to clipboard/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /suggest a title/i })).not.toBeInTheDocument();
  });

  it("keeps the suggestion when the score page is left and reopened", async () => {
    await freshInstall();
    const user = userEvent.setup();
    const { unmount } = render(<FirstRunAiTry analysis={FIRST} />);
    await user.click(await screen.findByRole("button", { name: /suggest a title/i }));
    await screen.findByDisplayValue("Best SEO Tools for Small Sites | Example");

    unmount();
    render(<FirstRunAiTry analysis={FIRST} />);

    expect(await screen.findByDisplayValue("Best SEO Tools for Small Sites | Example")).toBeInTheDocument();
    expect(generateRecommendationMock).toHaveBeenCalledTimes(1);
  });

  it("shows the quota message inline and as a toast when the allowance is used up", async () => {
    await freshInstall();
    generateRecommendationMock.mockRejectedValue(
      new AiProxyError("quota_exceeded", "You've used your free AI recommendations for this month."),
    );
    const user = userEvent.setup();
    render(<FirstRunAiTry analysis={FIRST} />);

    await user.click(await screen.findByRole("button", { name: /suggest a title/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/used your free ai recommendations/i);
    expect(useStore.getState().toast).toEqual({
      visible: true,
      message: "You've used your free AI recommendations for this month.",
    });
  });

  it("goes away when dismissed", async () => {
    await freshInstall();
    const user = userEvent.setup();
    render(<FirstRunAiTry analysis={FIRST} />);

    await user.click(await screen.findByRole("button", { name: /dismiss/i }));

    expect(prompt()).not.toBeInTheDocument();
    expect(generateRecommendationMock).not.toHaveBeenCalled();
  });
});
