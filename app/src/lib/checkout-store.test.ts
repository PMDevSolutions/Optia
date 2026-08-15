import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  PENDING_CHECKOUT_KEY,
  useCheckoutStore,
  type PendingCheckout,
} from "@/lib/checkout-store";
import { useEntitlementStore } from "@/lib/entitlement-store";
import { BillingError, createCheckoutSession, getCheckoutSessionStatus } from "@/lib/billing";
import { openInNewTab } from "@/lib/tabs";
import { getStorageItem, setStorageItem } from "@/lib/storage";

vi.mock("@/lib/billing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/billing")>();
  return {
    ...actual,
    createCheckoutSession: vi.fn(),
    getCheckoutSessionStatus: vi.fn(),
  };
});

vi.mock("@/lib/tabs", () => ({
  openInNewTab: vi.fn().mockResolvedValue(undefined),
  openOptionsPage: vi.fn(),
}));

const createSessionMock = vi.mocked(createCheckoutSession);
const sessionStatusMock = vi.mocked(getCheckoutSessionStatus);
const activateLicenseMock = vi.fn();

async function flush() {
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => {
  vi.useFakeTimers();
  useCheckoutStore.setState({
    paywallOpen: false,
    trigger: null,
    phase: "idle",
    error: null,
    sessionId: null,
  });
  useEntitlementStore.setState({
    isPro: false,
    activateLicense: activateLicenseMock,
  });
  activateLicenseMock.mockResolvedValue(true);
  createSessionMock.mockResolvedValue({
    url: "https://checkout.stripe.com/x",
    sessionId: "cs_1",
  });
  sessionStatusMock.mockResolvedValue({ status: "pending" });
});

afterEach(async () => {
  await useCheckoutStore.getState().cancelCheckout();
  vi.useRealTimers();
});

describe("checkout store", () => {
  it("opens and closes the paywall with a trigger", () => {
    useCheckoutStore.getState().openPaywall("quota");
    expect(useCheckoutStore.getState()).toMatchObject({ paywallOpen: true, trigger: "quota" });
    useCheckoutStore.getState().closePaywall();
    expect(useCheckoutStore.getState()).toMatchObject({ paywallOpen: false, trigger: null });
  });

  it("startCheckout creates a session, persists it, opens the tab, and polls", async () => {
    await useCheckoutStore.getState().startCheckout("monthly");
    await flush();

    expect(createSessionMock).toHaveBeenCalledWith(expect.any(String), expect.any(String));
    expect(openInNewTab).toHaveBeenCalledWith("https://checkout.stripe.com/x");
    expect(useCheckoutStore.getState().phase).toBe("polling");
    const pending = await getStorageItem<PendingCheckout>(PENDING_CHECKOUT_KEY);
    expect(pending?.sessionId).toBe("cs_1");
  });

  it("activates the license and reaches success when the claim is ready", async () => {
    sessionStatusMock
      .mockResolvedValueOnce({ status: "pending" })
      .mockResolvedValue({ status: "ready", licenseKey: "optia_key" });

    await useCheckoutStore.getState().startCheckout("monthly");
    await vi.advanceTimersByTimeAsync(5_000);

    expect(activateLicenseMock).toHaveBeenCalledWith("optia_key");
    expect(useCheckoutStore.getState().phase).toBe("success");
    expect(await getStorageItem(PENDING_CHECKOUT_KEY)).toBeNull();
  });

  it("reports an error pointing at options when activation fails after a claim", async () => {
    sessionStatusMock.mockResolvedValue({ status: "ready", licenseKey: "optia_key" });
    activateLicenseMock.mockResolvedValue(false);

    await useCheckoutStore.getState().startCheckout("monthly");
    await flush();

    expect(useCheckoutStore.getState().phase).toBe("error");
    expect(useCheckoutStore.getState().error).toMatch(/extension options/i);
  });

  it("treats gone as an error for a free user and clears the pending record", async () => {
    sessionStatusMock.mockResolvedValue({ status: "gone" });

    await useCheckoutStore.getState().startCheckout("monthly");
    await flush();

    expect(useCheckoutStore.getState().phase).toBe("error");
    expect(useCheckoutStore.getState().error).toMatch(/expired/i);
    expect(await getStorageItem(PENDING_CHECKOUT_KEY)).toBeNull();
  });

  it("treats gone as success when another context already activated Pro", async () => {
    sessionStatusMock.mockResolvedValue({ status: "gone" });
    useEntitlementStore.setState({ isPro: true });

    await useCheckoutStore.getState().startCheckout("monthly");
    await flush();

    expect(useCheckoutStore.getState().phase).toBe("success");
  });

  it("stops with a forbidden error on an install mismatch", async () => {
    sessionStatusMock.mockRejectedValue(new BillingError("forbidden", "mismatch"));

    await useCheckoutStore.getState().startCheckout("monthly");
    await flush();

    expect(useCheckoutStore.getState().phase).toBe("error");
    expect(await getStorageItem(PENDING_CHECKOUT_KEY)).toBeNull();
  });

  it("keeps polling through transient errors, then gives up with a fallback message", async () => {
    sessionStatusMock.mockRejectedValue(new BillingError("network", "offline"));

    await useCheckoutStore.getState().startCheckout("monthly");
    await vi.advanceTimersByTimeAsync(11 * 60 * 1000);

    expect(useCheckoutStore.getState().phase).toBe("error");
    expect(useCheckoutStore.getState().error).toMatch(/extension options/i);
    // Pending record survives so a later panel open can retry within the claim TTL.
    expect(await getStorageItem(PENDING_CHECKOUT_KEY)).not.toBeNull();
  });

  it("resumes a fresh pending checkout on mount", async () => {
    await setStorageItem<PendingCheckout>(PENDING_CHECKOUT_KEY, {
      sessionId: "cs_resume",
      createdAt: Date.now() - 5 * 60 * 1000,
    });
    sessionStatusMock.mockResolvedValue({ status: "ready", licenseKey: "optia_key" });

    await useCheckoutStore.getState().resumePendingCheckout();
    await flush();

    expect(activateLicenseMock).toHaveBeenCalledWith("optia_key");
    expect(useCheckoutStore.getState().phase).toBe("success");
  });

  it("discards a pending checkout older than the claim TTL", async () => {
    await setStorageItem<PendingCheckout>(PENDING_CHECKOUT_KEY, {
      sessionId: "cs_stale",
      createdAt: Date.now() - 2 * 60 * 60 * 1000,
    });

    await useCheckoutStore.getState().resumePendingCheckout();
    await flush();

    expect(useCheckoutStore.getState().phase).toBe("idle");
    expect(sessionStatusMock).not.toHaveBeenCalled();
    expect(await getStorageItem(PENDING_CHECKOUT_KEY)).toBeNull();
  });

  it("does not resume when the user is already Pro", async () => {
    await setStorageItem<PendingCheckout>(PENDING_CHECKOUT_KEY, {
      sessionId: "cs_pro",
      createdAt: Date.now(),
    });
    useEntitlementStore.setState({ isPro: true });

    await useCheckoutStore.getState().resumePendingCheckout();
    await flush();

    expect(sessionStatusMock).not.toHaveBeenCalled();
    expect(await getStorageItem(PENDING_CHECKOUT_KEY)).toBeNull();
  });

  it("cancelCheckout stops polling and clears the pending record", async () => {
    await useCheckoutStore.getState().startCheckout("monthly");
    await flush();
    expect(useCheckoutStore.getState().phase).toBe("polling");

    await useCheckoutStore.getState().cancelCheckout();
    const callsAfterCancel = sessionStatusMock.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);

    expect(useCheckoutStore.getState().phase).toBe("idle");
    expect(sessionStatusMock.mock.calls.length).toBe(callsAfterCancel);
    expect(await getStorageItem(PENDING_CHECKOUT_KEY)).toBeNull();
  });
});
