import { create } from "zustand";
import { aiStatusNow } from "@/lib/entitlement-store";
import { getStorageItem, setStorageItem } from "@/lib/storage";

// First-run AI try (#80): a fresh install gets one prompt, after its first
// completed analysis, to run a single hosted AI title suggestion. Dismissing
// onboarding marks an install as fresh, so installs that were past onboarding
// before this shipped never see it. The first completed analysis uses the mark
// up whether or not the prompt shows: it appears at most once per install, and
// only on the free tier.

export const FIRST_RUN_AI_TRY_KEY = "first_run_ai_try";

type FirstRunAiTryState = "pending" | "done";

/** Called when onboarding is dismissed: this install gets the try after its first analysis. */
export async function markFirstRunAiTryPending(): Promise<void> {
  if ((await getStorageItem<FirstRunAiTryState>(FIRST_RUN_AI_TRY_KEY)) === null) {
    await setStorageItem<FirstRunAiTryState>(FIRST_RUN_AI_TRY_KEY, "pending");
  }
}

let claimInFlight: Promise<boolean> | null = null;

/** True exactly once for a marked install, then never again. */
export function claimFirstRunAiTry(): Promise<boolean> {
  // Shared while in flight, so an effect that runs twice (StrictMode) claims once.
  claimInFlight ??= (async () => {
    const state = await getStorageItem<FirstRunAiTryState>(FIRST_RUN_AI_TRY_KEY);
    if (state !== "pending") return false;
    await setStorageItem<FirstRunAiTryState>(FIRST_RUN_AI_TRY_KEY, "done");
    return true;
  })().finally(() => {
    claimInFlight = null;
  });
  return claimInFlight;
}

interface FirstRunAiTryStore {
  /** Timestamp of the analysis the prompt belongs to; null while no prompt shows. */
  offeredFor: number | null;
  /** The suggestion the try produced, kept while moving between the score and its sections. */
  suggestion: string | null;
  /** Runs after an analysis completes; offers the try if this is the install's first. */
  offerAfterAnalysis: (analysisTimestamp: number) => Promise<void>;
  setSuggestion: (suggestion: string) => void;
  dismiss: () => void;
}

export const useFirstRunAiTry = create<FirstRunAiTryStore>((set) => ({
  offeredFor: null,
  suggestion: null,

  offerAfterAnalysis: async (analysisTimestamp) => {
    if (!(await claimFirstRunAiTry())) return;
    // Pro, or a free allowance already used up, spends the claim without a prompt.
    if (aiStatusNow().mode === "free") {
      set({ offeredFor: analysisTimestamp, suggestion: null });
    }
  },

  setSuggestion: (suggestion) => set({ suggestion }),

  dismiss: () => set({ offeredFor: null, suggestion: null }),
}));
