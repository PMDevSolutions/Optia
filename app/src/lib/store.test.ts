import { useStore } from "./store";

beforeEach(() => {
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

describe("useStore", () => {
  it("has correct default state", () => {
    const state = useStore.getState();

    expect(state.view).toBe("setup");
    expect(state.analysis).toBeNull();
    expect(state.activeCategory).toBeNull();
    expect(state.apiKey).toBe("");
    expect(state.error).toBeNull();
    expect(state.toast).toEqual({ visible: false, message: "" });
    expect(state.settings).toEqual({
      keyword: "",
      secondaryKeywords: "",
      pageType: "homepage",
      language: "en",
      advancedMode: false,
      targetUrl: "",
    });
  });

  it("setView changes the current view", () => {
    useStore.getState().setView("score");
    expect(useStore.getState().view).toBe("score");
  });

  it("setSettings merges partial updates without clobbering other fields", () => {
    useStore.getState().setSettings({ keyword: "react hooks" });

    const settings = useStore.getState().settings;
    expect(settings.keyword).toBe("react hooks");
    expect(settings.pageType).toBe("homepage");
    expect(settings.language).toBe("en");
    expect(settings.advancedMode).toBe(false);
    expect(settings.targetUrl).toBe("");
    expect(settings.secondaryKeywords).toBe("");
  });

  it("setActiveCategory sets category and switches view to subscores", () => {
    useStore.getState().setActiveCategory("meta");

    expect(useStore.getState().activeCategory).toBe("meta");
    expect(useStore.getState().view).toBe("subscores");
  });

  it("setActiveCategory(null) sets view to score", () => {
    useStore.setState({ view: "subscores", activeCategory: "meta" });
    useStore.getState().setActiveCategory(null);

    expect(useStore.getState().activeCategory).toBeNull();
    expect(useStore.getState().view).toBe("score");
  });

  it("setApiKey persists to chrome.storage and updates state", async () => {
    await useStore.getState().setApiKey("sk-test-123");

    expect(useStore.getState().apiKey).toBe("sk-test-123");
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      anthropic_api_key: "sk-test-123",
    });
  });

  it("loadApiKey reads api key from storage and sets it", async () => {
    await chrome.storage.local.set({ anthropic_api_key: "sk-loaded" });

    await useStore.getState().loadApiKey();

    expect(useStore.getState().apiKey).toBe("sk-loaded");
  });

  it("loadApiKey also loads default_language into settings", async () => {
    await chrome.storage.local.set({ default_language: "de" });

    await useStore.getState().loadApiKey();

    expect(useStore.getState().settings.language).toBe("de");
  });

  it("reset clears analysis, error, activeCategory and sets view to setup", () => {
    useStore.setState({
      view: "score",
      analysis: { score: 85 } as never,
      error: "something went wrong",
      activeCategory: "meta",
    });

    useStore.getState().reset();

    const state = useStore.getState();
    expect(state.view).toBe("setup");
    expect(state.analysis).toBeNull();
    expect(state.error).toBeNull();
    expect(state.activeCategory).toBeNull();
  });

  it("reset preserves targetUrl, keyword, advancedMode, pageType, secondaryKeywords, and language", () => {
    useStore.getState().setSettings({
      targetUrl: "https://example.com",
      keyword: "seo testing",
      advancedMode: true,
      pageType: "landing-page",
      secondaryKeywords: "vitest, react",
      language: "fr",
    });
    useStore.setState({
      analysis: { score: 90 } as never,
      view: "score",
    });

    useStore.getState().reset();

    const settings = useStore.getState().settings;
    expect(settings.targetUrl).toBe("https://example.com");
    expect(settings.keyword).toBe("seo testing");
    expect(settings.advancedMode).toBe(true);
    expect(settings.pageType).toBe("landing-page");
    expect(settings.secondaryKeywords).toBe("vitest, react");
    expect(settings.language).toBe("fr");
  });

  it("showToast sets visible to true with message, hideToast clears it", () => {
    useStore.getState().showToast("Analysis complete");

    expect(useStore.getState().toast).toEqual({
      visible: true,
      message: "Analysis complete",
    });

    useStore.getState().hideToast();

    expect(useStore.getState().toast).toEqual({
      visible: false,
      message: "",
    });
  });

  it("setError sets and clears the error", () => {
    useStore.getState().setError("Network timeout");
    expect(useStore.getState().error).toBe("Network timeout");

    useStore.getState().setError(null);
    expect(useStore.getState().error).toBeNull();
  });
});
