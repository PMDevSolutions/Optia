import { describe, it, expect, beforeEach } from "vitest";
import {
  FIRST_RUN_AI_TRY_KEY,
  claimFirstRunAiTry,
  markFirstRunAiTryPending,
  useFirstRunAiTry,
} from "@/lib/first-run-ai-try";
import { useEntitlementStore } from "@/lib/entitlement-store";
import { useStore } from "@/lib/store";
import { getStorageItem } from "@/lib/storage";

const ANALYSIS_AT = 1_793_000_000_000;

function setFree(freeAiRemaining: number | null = null) {
  useEntitlementStore.setState({ isPro: false, freeAiRemaining, freeAiLimit: 25 });
}

function setPro() {
  useEntitlementStore.setState({ isPro: true, aiQuotaRemaining: 1000, quotaLimit: 1000 });
}

beforeEach(() => {
  useStore.setState({ apiKey: "", useOwnKey: true, apiKeyInvalid: false });
  useFirstRunAiTry.setState({ offeredFor: null, suggestion: null });
  setFree();
});

describe("claimFirstRunAiTry", () => {
  it("never succeeds for an install that was past onboarding before this shipped", async () => {
    expect(await claimFirstRunAiTry()).toBe(false);
    expect(await getStorageItem(FIRST_RUN_AI_TRY_KEY)).toBeNull();
  });

  it("succeeds once after onboarding marks a fresh install, then never again", async () => {
    await markFirstRunAiTryPending();
    expect(await getStorageItem(FIRST_RUN_AI_TRY_KEY)).toBe("pending");

    expect(await claimFirstRunAiTry()).toBe(true);
    expect(await getStorageItem(FIRST_RUN_AI_TRY_KEY)).toBe("done");
    expect(await claimFirstRunAiTry()).toBe(false);
  });

  it("does not re-arm a spent try when onboarding is marked again", async () => {
    await markFirstRunAiTryPending();
    await claimFirstRunAiTry();

    await markFirstRunAiTryPending();

    expect(await getStorageItem(FIRST_RUN_AI_TRY_KEY)).toBe("done");
    expect(await claimFirstRunAiTry()).toBe(false);
  });

  it("gives overlapping calls one shared claim (an effect that runs twice)", async () => {
    await markFirstRunAiTryPending();

    const results = await Promise.all([claimFirstRunAiTry(), claimFirstRunAiTry()]);

    expect(results).toEqual([true, true]);
    expect(chrome.storage.local.set).toHaveBeenCalledTimes(2); // the mark, then one "done"
    expect(await claimFirstRunAiTry()).toBe(false);
  });
});

describe("useFirstRunAiTry.offerAfterAnalysis", () => {
  it("offers the try on a fresh free install's first analysis", async () => {
    await markFirstRunAiTryPending();

    await useFirstRunAiTry.getState().offerAfterAnalysis(ANALYSIS_AT);

    expect(useFirstRunAiTry.getState().offeredFor).toBe(ANALYSIS_AT);
  });

  it("offers nothing after later analyses", async () => {
    await markFirstRunAiTryPending();
    await useFirstRunAiTry.getState().offerAfterAnalysis(ANALYSIS_AT);
    useFirstRunAiTry.getState().dismiss();

    await useFirstRunAiTry.getState().offerAfterAnalysis(ANALYSIS_AT + 60_000);

    expect(useFirstRunAiTry.getState().offeredFor).toBeNull();
  });

  it("never offers on Pro, and Pro uses the try up", async () => {
    setPro();
    await markFirstRunAiTryPending();

    await useFirstRunAiTry.getState().offerAfterAnalysis(ANALYSIS_AT);

    expect(useFirstRunAiTry.getState().offeredFor).toBeNull();
    expect(await getStorageItem(FIRST_RUN_AI_TRY_KEY)).toBe("done");
  });

  it("does not offer a try the free allowance can no longer pay for", async () => {
    setFree(0);
    await markFirstRunAiTryPending();

    await useFirstRunAiTry.getState().offerAfterAnalysis(ANALYSIS_AT);

    expect(useFirstRunAiTry.getState().offeredFor).toBeNull();
  });

  it("dismiss hides the prompt and drops its suggestion", async () => {
    await markFirstRunAiTryPending();
    await useFirstRunAiTry.getState().offerAfterAnalysis(ANALYSIS_AT);
    useFirstRunAiTry.getState().setSuggestion("Best SEO Tools for 2026");

    useFirstRunAiTry.getState().dismiss();

    expect(useFirstRunAiTry.getState()).toMatchObject({ offeredFor: null, suggestion: null });
  });
});
