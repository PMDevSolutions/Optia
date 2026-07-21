import { render, screen, waitFor } from "@testing-library/react";
import { useStore } from "@/lib/store";
import { useEntitlementStore } from "@/lib/entitlement-store";
import { SetupPage } from "./SetupPage";

vi.mock("@/lib/storage", () => ({
  getKeywordForUrl: vi.fn().mockResolvedValue(null),
  getAdvancedOptions: vi.fn().mockResolvedValue(null),
  getStorageItem: vi.fn().mockResolvedValue(null),
  setStorageItem: vi.fn().mockResolvedValue(undefined),
}));

function setProEntitlement() {
  useEntitlementStore.setState({
    isPro: true,
    tier: "pro",
    canUseAdvancedOptions: true,
    canUseMultiLanguage: true,
    canUseSchema: true,
    canBringOwnKey: true,
    aiQuotaRemaining: 100,
    quotaLimit: 100,
  });
}

beforeEach(() => {
  useEntitlementStore.setState({
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
    view: "setup",
    analysis: null,
    settings: {
      keyword: "",
      secondaryKeywords: "",
      pageType: "homepage",
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

describe("SetupPage", () => {
  const onAnalyze = vi.fn();

  it("renders heading 'Set up your SEO analysis'", () => {
    render(<SetupPage onAnalyze={onAnalyze} />);
    expect(
      screen.getByRole("heading", { name: /set up your seo analysis/i }),
    ).toBeInTheDocument();
  });

  it("renders 'Main keyword' input", () => {
    render(<SetupPage onAnalyze={onAnalyze} />);
    expect(screen.getByLabelText(/main keyword/i)).toBeInTheDocument();
  });

  it("renders 'Optimize my SEO' button", () => {
    render(<SetupPage onAnalyze={onAnalyze} />);
    expect(
      screen.getByRole("button", { name: /optimize my seo/i }),
    ).toBeInTheDocument();
  });

  it("button is disabled when keyword is empty", () => {
    render(<SetupPage onAnalyze={onAnalyze} />);
    expect(
      screen.getByRole("button", { name: /optimize my seo/i }),
    ).toBeDisabled();
  });

  it("button is enabled when keyword and targetUrl are entered", () => {
    useStore.setState({
      settings: {
        keyword: "react testing",
        secondaryKeywords: "",
        pageType: "homepage",
        language: "en",
        advancedMode: false,
        targetUrl: "https://example.com",
      },
    });
    render(<SetupPage onAnalyze={onAnalyze} />);
    expect(
      screen.getByRole("button", { name: /optimize my seo/i }),
    ).toBeEnabled();
  });

  it("renders Advanced Analysis toggle", () => {
    render(<SetupPage onAnalyze={onAnalyze} />);
    expect(screen.getByText(/advanced analysis/i)).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("hides advanced fields when advancedMode is false", () => {
    render(<SetupPage onAnalyze={onAnalyze} />);
    expect(screen.queryByLabelText(/page type/i)).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(/seo webflow/i),
    ).not.toBeInTheDocument();
  });

  it("shows advanced fields when advancedMode is true", () => {
    setProEntitlement();
    useStore.setState({
      settings: {
        keyword: "",
        secondaryKeywords: "",
        pageType: "homepage",
        language: "en",
        advancedMode: true,
        targetUrl: "",
      },
    });
    render(<SetupPage onAnalyze={onAnalyze} />);
    expect(screen.getByLabelText(/page type/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/seo webflow/i),
    ).toBeInTheDocument();
  });

  it("shows page type select in advanced mode", () => {
    setProEntitlement();
    useStore.setState({
      settings: {
        keyword: "",
        secondaryKeywords: "",
        pageType: "homepage",
        language: "en",
        advancedMode: true,
        targetUrl: "",
      },
    });
    render(<SetupPage onAnalyze={onAnalyze} />);
    const pageTypeSelect = screen.getByLabelText(/page type/i);
    expect(pageTypeSelect).toBeInTheDocument();
    expect(pageTypeSelect).toHaveValue("homepage");
  });

  it("shows the language select in the settings panel for Pro users", async () => {
    setProEntitlement();
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(<SetupPage onAnalyze={onAnalyze} />);
    // Language should not be visible initially
    expect(screen.queryByLabelText(/ai recommendations language/i)).not.toBeInTheDocument();
    // Click the settings gear icon
    await user.click(screen.getByRole("button", { name: /settings/i }));
    // Now the language select should be visible and editable
    const langSelect = screen.getByLabelText(/ai recommendations language/i);
    expect(langSelect).toBeInTheDocument();
    expect(langSelect).toHaveValue("en");
  });

  it("gates the API key and language behind Pro in the settings panel for free users", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(<SetupPage onAnalyze={onAnalyze} />);
    await user.click(screen.getByRole("button", { name: /settings/i }));

    // No editable Anthropic key input and no language select for free users
    expect(screen.queryByLabelText(/anthropic api key/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/ai recommendations language/i)).not.toBeInTheDocument();
    // Both surfaces show a Pro pill instead
    expect(screen.getAllByText("Pro").length).toBeGreaterThanOrEqual(2);
  });

  it("shows the Anthropic API key input in the settings panel for Pro users", async () => {
    setProEntitlement();
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(<SetupPage onAnalyze={onAnalyze} />);
    await user.click(screen.getByRole("button", { name: /settings/i }));

    const keyInput = screen.getByLabelText(/anthropic api key/i);
    expect(keyInput).toBeInTheDocument();
    expect(keyInput).toHaveAttribute("type", "password");
  });

  it("shows secondary keywords textarea in advanced mode", () => {
    setProEntitlement();
    useStore.setState({
      settings: {
        keyword: "",
        secondaryKeywords: "",
        pageType: "homepage",
        language: "en",
        advancedMode: true,
        targetUrl: "",
      },
    });
    render(<SetupPage onAnalyze={onAnalyze} />);
    expect(
      screen.getByPlaceholderText(/seo webflow/i),
    ).toBeInTheDocument();
  });

  it("shows character counter for secondary keywords", () => {
    setProEntitlement();
    useStore.setState({
      settings: {
        keyword: "",
        secondaryKeywords: "hello",
        pageType: "homepage",
        language: "en",
        advancedMode: true,
        targetUrl: "",
      },
    });
    render(<SetupPage onAnalyze={onAnalyze} />);
    expect(screen.getByText(/5\/2000 characters/i)).toBeInTheDocument();
  });

  it("shows 'Page URL to analyze' input in dev mode", () => {
    render(<SetupPage onAnalyze={onAnalyze} />);
    expect(screen.getByLabelText(/page url to analyze/i)).toBeInTheDocument();
  });

  it("disables the Advanced Analysis toggle with a Pro badge for free users", () => {
    render(<SetupPage onAnalyze={onAnalyze} />);
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText(/activate an optia pro license/i)).toBeInTheDocument();
  });

  it("enables the Advanced Analysis toggle for Pro users", () => {
    setProEntitlement();
    render(<SetupPage onAnalyze={onAnalyze} />);
    expect(screen.getByRole("checkbox")).toBeEnabled();
    expect(screen.getByText(/optional/i)).toBeInTheDocument();
  });

  it("forces advancedMode off when there is no Pro entitlement", async () => {
    useStore.setState({
      settings: {
        keyword: "",
        secondaryKeywords: "",
        pageType: "homepage",
        language: "en",
        advancedMode: true,
        targetUrl: "",
      },
    });
    render(<SetupPage onAnalyze={onAnalyze} />);
    await waitFor(() => {
      expect(useStore.getState().settings.advancedMode).toBe(false);
    });
    expect(screen.queryByLabelText(/page type/i)).not.toBeInTheDocument();
  });

  it("shows the plan status row in the settings panel", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(<SetupPage onAnalyze={onAnalyze} />);
    await user.click(screen.getByRole("button", { name: /settings/i }));
    expect(screen.getByText("Plan")).toBeInTheDocument();
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText(/manage your license/i)).toBeInTheDocument();
  });
});
