import { render, screen } from "@testing-library/react";
import { useStore } from "@/lib/store";
import { useEntitlementStore } from "@/lib/entitlement-store";
import { ScorePage } from "./ScorePage";
import type { SEOAnalysis, PageSEOData } from "@/types/seo";

vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

vi.mock("@/lib/storage", () => ({
  getStorageItem: vi.fn().mockResolvedValue(null),
  setStorageItem: vi.fn().mockResolvedValue(undefined),
}));

const mockPageData: PageSEOData = {
  url: "https://example.com",
  title: "Test",
  metaDescription: "",
  metaKeywords: "",
  canonical: "",
  h1: [],
  h2: [],
  h3: [],
  h4: [],
  h5: [],
  h6: [],
  images: [],
  ogTags: {},
  twitterTags: {},
  wordCount: 0,
  internalLinks: 0,
  externalLinks: 0,
  lang: "",
  paragraphs: [],
  resources: { js: [], css: [] },
  schemaMarkup: { types: [], count: 0 },
  ogImage: "",
  imageFileSizes: [],
  fetchWarnings: [],
};

const mockAnalysis: SEOAnalysis = {
  overallScore: 75,
  scoreLabel: "Fair",
  scoreDescription: "A solid start!",
  totalPassed: 15,
  totalFailed: 5,
  categories: [
    { category: "meta", label: "Meta Tags", score: 80, passed: 4, total: 5, checks: [] },
    { category: "content", label: "Content Analysis", score: 70, passed: 3, total: 5, checks: [] },
    { category: "links", label: "Links", score: 100, passed: 2, total: 2, checks: [] },
    { category: "images", label: "Images", score: 60, passed: 2, total: 4, checks: [] },
    { category: "technical", label: "Technical SEO", score: 80, passed: 4, total: 5, checks: [] },
  ],
  pageData: mockPageData,
  keyword: "seo",
  timestamp: Date.now(),
};

beforeEach(() => {
  useEntitlementStore.setState({ entitlementLoaded: false, isPro: false, tier: "free" });
  useStore.setState({
    view: "score",
    analysis: null,
    settings: {
      keyword: "seo",
      secondaryKeywords: "",
      pageType: "blog-post",
      language: "en",
      advancedMode: false,
      targetUrl: "",
    },
    activeCategory: null,
    apiKey: "",
    error: null,
    toast: { visible: false, message: "" },
  });
});

describe("ScorePage", () => {
  it("returns null when no analysis", () => {
    const { container } = render(<ScorePage />);
    expect(container.innerHTML).toBe("");
  });

  it("renders score label", () => {
    useStore.setState({ analysis: mockAnalysis });
    render(<ScorePage />);
    expect(screen.getByRole("heading", { name: "Fair" })).toBeInTheDocument();
  });

  it("renders score description", () => {
    useStore.setState({ analysis: mockAnalysis });
    render(<ScorePage />);
    expect(screen.getByText("A solid start!")).toBeInTheDocument();
  });

  it("shows passed count", () => {
    useStore.setState({ analysis: mockAnalysis });
    render(<ScorePage />);
    expect(screen.getByText("15 passed")).toBeInTheDocument();
  });

  it("shows failed count", () => {
    useStore.setState({ analysis: mockAnalysis });
    render(<ScorePage />);
    expect(screen.getByText("5 to improve")).toBeInTheDocument();
  });

  it("renders all 5 category labels", () => {
    useStore.setState({ analysis: mockAnalysis });
    render(<ScorePage />);
    expect(screen.getByText("Meta Tags")).toBeInTheDocument();
    expect(screen.getByText("Content Analysis")).toBeInTheDocument();
    expect(screen.getByText("Links")).toBeInTheDocument();
    expect(screen.getByText("Images")).toBeInTheDocument();
    expect(screen.getByText("Technical SEO")).toBeInTheDocument();
  });

  it("renders 'New Analysis' button", () => {
    useStore.setState({ analysis: mockAnalysis });
    render(<ScorePage />);
    expect(
      screen.getByRole("button", { name: /new analysis/i }),
    ).toBeInTheDocument();
  });

  it("shows the header Upgrade pill for free users", () => {
    useEntitlementStore.setState({ entitlementLoaded: true, isPro: false });
    useStore.setState({ analysis: mockAnalysis });
    render(<ScorePage />);
    expect(screen.getByRole("button", { name: /upgrade/i })).toBeInTheDocument();
  });

  it("hides the header Upgrade pill for Pro users", () => {
    useEntitlementStore.setState({ entitlementLoaded: true, isPro: true, tier: "pro" });
    useStore.setState({ analysis: mockAnalysis });
    render(<ScorePage />);
    expect(screen.queryByRole("button", { name: /upgrade/i })).not.toBeInTheDocument();
  });

  it("shows warning banner when fetchWarnings present", () => {
    const analysisWithWarnings: SEOAnalysis = {
      ...mockAnalysis,
      pageData: {
        ...mockPageData,
        fetchWarnings: ["JavaScript rendering detected"],
      },
    };
    useStore.setState({ analysis: analysisWithWarnings });
    render(<ScorePage />);
    expect(
      screen.getByText("JavaScript rendering detected"),
    ).toBeInTheDocument();
  });
});
