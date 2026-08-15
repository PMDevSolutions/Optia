import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OverQuotaNotice } from "./OverQuotaNotice";
import { useCheckoutStore } from "@/lib/checkout-store";
import { useEntitlementStore } from "@/lib/entitlement-store";
import { useStore } from "@/lib/store";

beforeEach(() => {
  useStore.setState({ apiKey: "" });
  useCheckoutStore.setState({ paywallOpen: false, trigger: null, phase: "idle" });
  useEntitlementStore.setState({
    entitlementLoaded: true,
    isPro: false,
    tier: "free",
    quotaLimit: 0,
    aiQuotaRemaining: 0,
    freeAiRemaining: null,
    freeAiLimit: null,
  });
});

describe("OverQuotaNotice", () => {
  it("renders nothing while free AI remains available", () => {
    useEntitlementStore.setState({ freeAiRemaining: 3, freeAiLimit: 25 });
    render(<OverQuotaNotice />);
    expect(screen.queryByText(/free ai generations/i)).not.toBeInTheDocument();
  });

  it("renders nothing when the free allowance is still unknown", () => {
    render(<OverQuotaNotice />);
    expect(screen.queryByText(/free ai generations/i)).not.toBeInTheDocument();
  });

  it("shows the friendly prompt with reset timing and an upgrade CTA when free quota runs out", async () => {
    useEntitlementStore.setState({ freeAiRemaining: 0, freeAiLimit: 25 });
    const user = userEvent.setup();
    render(<OverQuotaNotice />);

    expect(screen.getByText(/used all 25 free ai generations/i)).toBeInTheDocument();
    expect(screen.getByText(/resets/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /upgrade to pro/i }));
    expect(useCheckoutStore.getState()).toMatchObject({ paywallOpen: true, trigger: "quota" });
  });

  it("shows reset timing but no upgrade CTA for an over-quota Pro user", () => {
    useEntitlementStore.setState({
      isPro: true,
      tier: "pro",
      quotaLimit: 1000,
      aiQuotaRemaining: 0,
    });
    render(<OverQuotaNotice />);

    expect(screen.getByText(/1,000 pro ai generations/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /upgrade/i })).not.toBeInTheDocument();
  });
});
