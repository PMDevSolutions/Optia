import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UpgradeButton } from "./UpgradeButton";
import { useCheckoutStore } from "@/lib/checkout-store";
import { useEntitlementStore } from "@/lib/entitlement-store";

beforeEach(() => {
  useEntitlementStore.setState({ entitlementLoaded: false, isPro: false });
  useCheckoutStore.setState({ paywallOpen: false, trigger: null, phase: "idle" });
});

describe("UpgradeButton", () => {
  it("renders nothing before the entitlement has loaded", () => {
    render(<UpgradeButton />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders nothing for Pro users", () => {
    useEntitlementStore.setState({ entitlementLoaded: true, isPro: true });
    render(<UpgradeButton />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("opens the paywall for free users, including via keyboard", async () => {
    useEntitlementStore.setState({ entitlementLoaded: true, isPro: false });
    const user = userEvent.setup();
    render(<UpgradeButton />);

    const button = screen.getByRole("button", { name: /upgrade/i });
    button.focus();
    await user.keyboard("{Enter}");

    expect(useCheckoutStore.getState()).toMatchObject({ paywallOpen: true, trigger: "header" });
  });
});
