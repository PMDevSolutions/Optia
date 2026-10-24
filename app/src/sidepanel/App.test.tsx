import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "./App";
import { useStore } from "@/lib/store";
import { fetchAndAnalyzePage } from "@/lib/fetch-page";
import { recordAnalysis, reportUsageIfDue } from "@/lib/usage";
import type { PageSEOData } from "@/types/seo";

// The harness path (no chrome.tabs in jsdom) fetches the page by URL; stub the
// fetch and the usage layer so this suite only sees how App drives them.
vi.mock("@/lib/fetch-page", () => ({ fetchAndAnalyzePage: vi.fn() }));
vi.mock("@/lib/usage", () => ({
  recordAnalysis: vi.fn(),
  reportUsageIfDue: vi.fn(),
}));
vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

const fetchAndAnalyzePageMock = vi.mocked(fetchAndAnalyzePage);
const recordAnalysisMock = vi.mocked(recordAnalysis);
const reportUsageIfDueMock = vi.mocked(reportUsageIfDue);

const pageData: PageSEOData = {
  url: "https://example.com/",
  title: "Example Domain",
  metaDescription: "An example page",
  metaKeywords: "",
  canonical: "https://example.com/",
  h1: ["Example Domain"],
  h2: [],
  h3: [],
  h4: [],
  h5: [],
  h6: [],
  images: [],
  ogTags: {},
  twitterTags: {},
  wordCount: 120,
  internalLinks: 1,
  externalLinks: 1,
  lang: "en",
  paragraphs: ["This domain is for use in examples."],
  resources: { js: [], css: [] },
  schemaMarkup: { types: [], count: 0 },
  ogImage: "",
  imageFileSizes: [],
  fetchWarnings: [],
};

async function analyze(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /optimize my seo/i }));
}

beforeEach(async () => {
  // Past onboarding, on the setup screen with a URL and keyword filled in.
  await chrome.storage.local.set({ onboarding_dismissed: true });
  useStore.setState({
    view: "setup",
    analysis: null,
    activeCategory: null,
    error: null,
    settings: {
      keyword: "example",
      secondaryKeywords: "",
      pageType: "homepage",
      language: "en",
      advancedMode: false,
      targetUrl: "https://example.com/",
    },
  });
  fetchAndAnalyzePageMock.mockResolvedValue(pageData);
  recordAnalysisMock.mockResolvedValue(undefined);
  reportUsageIfDueMock.mockResolvedValue(undefined);
});

describe("App analysis usage counting", () => {
  it("counts each completed analysis exactly once, then checks for a due report", async () => {
    const user = userEvent.setup();
    render(<App />);

    await analyze(user);
    await screen.findByRole("button", { name: /new analysis/i });

    expect(recordAnalysisMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(reportUsageIfDueMock).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: /new analysis/i }));
    await analyze(user);
    await screen.findByRole("button", { name: /new analysis/i });

    expect(recordAnalysisMock).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(reportUsageIfDueMock).toHaveBeenCalledTimes(2));
  });

  it("does not count an analysis that failed", async () => {
    const user = userEvent.setup();
    fetchAndAnalyzePageMock.mockRejectedValue(new Error("Could not fetch the page"));
    render(<App />);

    await analyze(user);

    expect(await screen.findByText(/could not fetch the page/i)).toBeInTheDocument();
    expect(recordAnalysisMock).not.toHaveBeenCalled();
    expect(reportUsageIfDueMock).not.toHaveBeenCalled();
  });

  it("still shows the results when the local count cannot be saved", async () => {
    const user = userEvent.setup();
    recordAnalysisMock.mockRejectedValue(new Error("storage unavailable"));
    render(<App />);

    await analyze(user);

    expect(await screen.findByRole("button", { name: /new analysis/i })).toBeInTheDocument();
    expect(reportUsageIfDueMock).not.toHaveBeenCalled();
  });
});
