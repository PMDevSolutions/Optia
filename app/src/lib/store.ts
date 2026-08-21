import { create } from "zustand";
import type {
  AppState,
  SEOAnalysis,
  AnalysisSettings,
  CheckCategory,
} from "@/types/seo";
import { getStorageItem, setStorageItem } from "./storage";

interface ToastState {
  visible: boolean;
  message: string;
}

interface Store extends AppState {
  toast: ToastState;
  /** Pro preference: route AI through the user's own Anthropic key. Unset in storage means true. */
  useOwnKey: boolean;
  /** Session-scoped: the stored key was rejected by Anthropic (401/403). Never persisted. */
  apiKeyInvalid: boolean;
  /** Selected Claude model for hosted (proxy) generation; null = server default. */
  hostedModel: string | null;
  /** Selected Claude model for BYO-key direct generation; null = built-in default. */
  byokModel: string | null;
  setView: (view: AppState["view"]) => void;
  setAnalysis: (analysis: SEOAnalysis) => void;
  setSettings: (settings: Partial<AnalysisSettings>) => void;
  setActiveCategory: (category: CheckCategory | null) => void;
  setApiKey: (key: string) => void;
  setUseOwnKey: (value: boolean) => Promise<void>;
  setHostedModel: (model: string | null) => Promise<void>;
  setByokModel: (model: string | null) => Promise<void>;
  setApiKeyInvalid: (value: boolean) => void;
  setError: (error: string | null) => void;
  showToast: (message: string) => void;
  hideToast: () => void;
  loadApiKey: () => Promise<void>;
  reset: () => void;
}

const defaultSettings: AnalysisSettings = {
  keyword: "",
  secondaryKeywords: "",
  pageType: "homepage",
  language: "en",
  advancedMode: false,
  targetUrl: "",
};

export const useStore = create<Store>((set) => ({
  view: "setup",
  analysis: null,
  settings: { ...defaultSettings },
  activeCategory: null,
  apiKey: "",
  useOwnKey: true,
  apiKeyInvalid: false,
  hostedModel: null,
  byokModel: null,
  error: null,
  toast: { visible: false, message: "" },

  setView: (view) => set({ view }),
  setAnalysis: (analysis) => set({ analysis }),
  setSettings: (partial) =>
    set((state) => ({ settings: { ...state.settings, ...partial } })),
  setActiveCategory: (category) =>
    set({ activeCategory: category, view: category ? "subscores" : "score" }),
  setApiKey: async (key) => {
    await setStorageItem("anthropic_api_key", key);
    // A new key is fresh trust — clear any prior rejection.
    set({ apiKey: key, apiKeyInvalid: false });
  },
  setUseOwnKey: async (value) => {
    await setStorageItem("use_own_key", value);
    // Turning the toggle is a deliberate retry — clear any prior rejection.
    set({ useOwnKey: value, apiKeyInvalid: false });
  },
  setHostedModel: async (model) => {
    await setStorageItem("hosted_model", model);
    set({ hostedModel: model });
  },
  setByokModel: async (model) => {
    await setStorageItem("byok_model", model);
    set({ byokModel: model });
  },
  setApiKeyInvalid: (value) => set({ apiKeyInvalid: value }),
  setError: (error) => set({ error }),
  showToast: (message) => set({ toast: { visible: true, message } }),
  hideToast: () => set({ toast: { visible: false, message: "" } }),
  loadApiKey: async () => {
    const key = await getStorageItem<string>("anthropic_api_key");
    if (key) set({ apiKey: key });
    const useOwn = await getStorageItem<boolean>("use_own_key");
    // Unset means true: a stored key defaults to being used (preserves pre-toggle behavior).
    set({ useOwnKey: useOwn !== false });
    const lang = await getStorageItem<string>("default_language");
    if (lang) set((state) => ({ settings: { ...state.settings, language: lang } }));
    const hostedModel = await getStorageItem<string>("hosted_model");
    const byokModel = await getStorageItem<string>("byok_model");
    set({ hostedModel: hostedModel ?? null, byokModel: byokModel ?? null });
  },
  reset: () =>
    set((state) => ({
      view: "setup",
      analysis: null,
      settings: {
        ...defaultSettings,
        targetUrl: state.settings.targetUrl,
        keyword: state.settings.keyword,
        advancedMode: state.settings.advancedMode,
        pageType: state.settings.pageType,
        secondaryKeywords: state.settings.secondaryKeywords,
        language: state.settings.language,
      },
      activeCategory: null,
      error: null,
    })),
}));
