import { render, screen } from "@testing-library/react";
import { useStore } from "@/lib/store";
import { useEntitlementStore } from "@/lib/entitlement-store";
import { getSchemaRecommendations } from "@/lib/schema-recommendations";
import { SubscoresPage } from "./SubscoresPage";
import type { SEOAnalysis, PageSEOData, SEOCheck, SchemaRecommendation } from "@/types/seo";

// The AI facade now lives at "@/lib/ai" (the old "@/lib/openai" module is gone).
// Signatures dropped the leading apiKey arg, but for these render tests we only
// need stubbed promises — the page never awaits them here.
vi.mock("@/lib/ai", () => ({
  generateRecommendation: vi.fn().mockResolvedValue("suggested title"),
  generateH2Suggestion: vi.fn().mockResolvedValue("new h2"),
  generateAllH2Suggestions: vi.fn().mockResolvedValue(["new h2"]),
  generateAltText: vi.fn().mockResolvedValue("alt text"),
}));

vi.mock("@/lib/schema-recommendations", () => ({
  getSchemaRecommendations: vi.fn().mockReturnValue([]),
}));

vi.mock("@/lib/storage", () => ({
  getStorageItem: vi.fn().mockResolvedValue(null),
  setStorageItem: vi.fn().mockResolvedValue(undefined),
}));

const mockChecks = [
  {
    id: "title-present",
    title: "Page has a title tag",
    description: "test",
    status: "pass" as const,
    priority: "high" as const,
    category: "meta" as const,
    details: "Title found",
  },
  {
    id: "title-keyword",
    title: "Title contains keyword",
    description: "test",
    status: "fail" as const,
    priority: "high" as const,
    category: "meta" as const,
    details: "Not found",
    copyable: true,
  },
];

const mockPageData: PageSEOData = {
  url: "https://example.com",
  title: "Old Title",
  metaDescription: "",
  metaKeywords: "",
  canonical: "",
  h1: ["Old H1"],
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
  paragraphs: ["First paragraph"],
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
    {
      category: "meta",
      label: "Meta Tags",
      score: 80,
      passed: 1,
      total: 2,
      checks: mockChecks,
    },
  ],
  pageData: mockPageData,
  keyword: "seo",
  timestamp: Date.now(),
};

// A failing schema-markup check drives the Pro schema gate.
const schemaCheck: SEOCheck = {
  id: "schema-markup",
  title: "Structured data present",
  description: "test",
  status: "fail",
  priority: "medium",
  category: "meta",
  details: "No structured data found on this page",
};

const schemaAnalysis: SEOAnalysis = {
  ...mockAnalysis,
  categories: [
    {
      category: "meta",
      label: "Meta Tags",
      score: 50,
      passed: 0,
      total: 1,
      checks: [schemaCheck],
    },
  ],
};

const testSchema: SchemaRecommendation = {
  name: "BlogPosting",
  description: "Enables article rich results",
  documentationUrl: "https://example.com/docs",
  googleSupport: "yes",
  jsonLdCode: '{"@type":"BlogPosting"}',
  isRequired: true,
};

// ── Entitlement helpers ──
// useCanUseAI() derives from computeAiStatus over the entitlement + app stores.
// For a free user, freeAiRemaining === null (unknown, pre-call) is treated as
// available; freeAiRemaining <= 0 (with a known limit) is "locked".

/** Free tier with AI still available (canUseAI === true). */
function setFreeAiAvailable() {
  useEntitlementStore.setState({
    isPro: false,
    tier: "free",
    freeAiRemaining: 5,
    freeAiLimit: 10,
    aiQuotaRemaining: 0,
    quotaLimit: 0,
  });
}

/** Free tier with AI allowance exhausted (canUseAI === false / locked). */
function setFreeAiLocked() {
  useEntitlementStore.setState({
    isPro: false,
    tier: "free",
    freeAiRemaining: 0,
    freeAiLimit: 10,
    aiQuotaRemaining: 0,
    quotaLimit: 0,
  });
}

beforeEach(() => {
  vi.mocked(getSchemaRecommendations).mockReturnValue([]);
  useEntitlementStore.setState({
    entitlementLoaded: true,
    isPro: false,
    tier: "free",
    expiresAt: null,
    quotaLimit: 0,
    aiQuotaRemaining: 0,
    freeAiRemaining: null,
    freeAiLimit: null,
    canUseAdvancedOptions: false,
    canUseMultiLanguage: false,
    canUseSchema: false,
    canBringOwnKey: false,
    hasLicenseKey: false,
  });
  useStore.setState({
    view: "subscores",
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

describe("SubscoresPage", () => {
  it("returns null when no analysis", () => {
    const { container } = render(<SubscoresPage />);
    expect(container.innerHTML).toBe("");
  });

  it("returns null when no activeCategory", () => {
    useStore.setState({ analysis: mockAnalysis });
    const { container } = render(<SubscoresPage />);
    expect(container.innerHTML).toBe("");
  });

  it("renders category heading", () => {
    useStore.setState({ analysis: mockAnalysis, activeCategory: "meta" });
    render(<SubscoresPage />);
    expect(
      screen.getByRole("heading", { name: "Meta Tags" }),
    ).toBeInTheDocument();
  });

  it("shows passed count", () => {
    useStore.setState({ analysis: mockAnalysis, activeCategory: "meta" });
    render(<SubscoresPage />);
    expect(screen.getByText("1 passed")).toBeInTheDocument();
  });

  it("shows failed count", () => {
    useStore.setState({ analysis: mockAnalysis, activeCategory: "meta" });
    render(<SubscoresPage />);
    expect(screen.getByText("1 to improve")).toBeInTheDocument();
  });

  it("renders check items", () => {
    useStore.setState({ analysis: mockAnalysis, activeCategory: "meta" });
    render(<SubscoresPage />);
    expect(screen.getByText("Page has a title tag")).toBeInTheDocument();
    expect(screen.getByText("Title contains keyword")).toBeInTheDocument();
  });

  it("renders back button", () => {
    useStore.setState({ analysis: mockAnalysis, activeCategory: "meta" });
    render(<SubscoresPage />);
    // Back button is the ArrowLeft icon button
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it("shows failing checks before passing checks", () => {
    useStore.setState({ analysis: mockAnalysis, activeCategory: "meta" });
    render(<SubscoresPage />);
    const titles = screen
      .getAllByText(/page has a title tag|title contains keyword/i)
      .map((el) => el.textContent);
    // Fail items sorted first
    expect(titles[0]).toBe("Title contains keyword");
    expect(titles[1]).toBe("Page has a title tag");
  });

  it("pass check items show their title", () => {
    useStore.setState({ analysis: mockAnalysis, activeCategory: "meta" });
    render(<SubscoresPage />);
    expect(screen.getByText("Page has a title tag")).toBeInTheDocument();
  });

  it("fail check items show their title", () => {
    useStore.setState({ analysis: mockAnalysis, activeCategory: "meta" });
    render(<SubscoresPage />);
    expect(screen.getByText("Title contains keyword")).toBeInTheDocument();
  });

  // ── Scoring stays free ──
  // The score breakdown (category header, pass/fail summary, per-check list)
  // renders for every tier — it never depends on the AI/schema entitlement.
  describe("scoring stays free", () => {
    it("renders the category card and per-check list for a free user with AI locked", () => {
      setFreeAiLocked();
      useStore.setState({ analysis: mockAnalysis, activeCategory: "meta" });
      render(<SubscoresPage />);

      expect(
        screen.getByRole("heading", { name: "Meta Tags" }),
      ).toBeInTheDocument();
      expect(screen.getByText("1 passed")).toBeInTheDocument();
      expect(screen.getByText("1 to improve")).toBeInTheDocument();
      expect(screen.getByText("Page has a title tag")).toBeInTheDocument();
      expect(screen.getByText("Title contains keyword")).toBeInTheDocument();
    });
  });

  // ── Schema markup Pro gate ──
  describe("schema markup gate", () => {
    it("shows the Pro upsell when canUseSchema is false", () => {
      useEntitlementStore.setState({ canUseSchema: false });
      vi.mocked(getSchemaRecommendations).mockReturnValue([testSchema]);
      useStore.setState({ analysis: schemaAnalysis, activeCategory: "meta" });
      render(<SubscoresPage />);

      expect(
        screen.getByText(/Schema markup generation is an Optia Pro feature/i),
      ).toBeInTheDocument();
      // The generated schema (SchemaDisplay) must NOT render for free users.
      expect(
        screen.queryByText(/Recommended Schema Markup/i),
      ).not.toBeInTheDocument();
    });

    it("renders SchemaDisplay when canUseSchema is true", () => {
      useEntitlementStore.setState({ canUseSchema: true });
      vi.mocked(getSchemaRecommendations).mockReturnValue([testSchema]);
      useStore.setState({ analysis: schemaAnalysis, activeCategory: "meta" });
      render(<SubscoresPage />);

      expect(
        screen.getByText(/Recommended Schema Markup/i),
      ).toBeInTheDocument();
      expect(screen.getByText("BlogPosting")).toBeInTheDocument();
      // The upsell must NOT render for Pro users.
      expect(
        screen.queryByText(/Schema markup generation is an Optia Pro feature/i),
      ).not.toBeInTheDocument();
    });
  });

  // ── AI regenerate widgets track useCanUseAI() ──
  describe("AI recommendation widgets", () => {
    it("disables the regenerate control when AI is locked", () => {
      setFreeAiLocked();
      useStore.setState({ analysis: mockAnalysis, activeCategory: "meta" });
      render(<SubscoresPage />);

      const regenerate = screen.getByTitle(
        /Activate Optia Pro or add your own Anthropic key in options/i,
      );
      expect(regenerate).toBeDisabled();
    });

    it("enables the regenerate control when AI is available", () => {
      setFreeAiAvailable();
      useStore.setState({ analysis: mockAnalysis, activeCategory: "meta" });
      render(<SubscoresPage />);

      const regenerate = screen.getByTitle("Regenerate");
      expect(regenerate).toBeEnabled();
    });
  });
});
