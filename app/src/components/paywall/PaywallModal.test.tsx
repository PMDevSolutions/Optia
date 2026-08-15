import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaywallModal } from "./PaywallModal";
import { useCheckoutStore } from "@/lib/checkout-store";
import { useEntitlementStore } from "@/lib/entitlement-store";

const startCheckoutMock = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  startCheckoutMock.mockClear();
  useEntitlementStore.setState({
    entitlementLoaded: true,
    isPro: false,
    freeAiLimit: null,
    freeAiRemaining: null,
  });
  useCheckoutStore.setState({
    paywallOpen: true,
    trigger: "header",
    phase: "idle",
    error: null,
    sessionId: null,
    startCheckout: startCheckoutMock,
  });
});

describe("PaywallModal", () => {
  it("lists Pro benefits and both plan prices", () => {
    render(<PaywallModal />);

    expect(screen.getByRole("dialog", { name: /optia pro/i })).toBeInTheDocument();
    expect(screen.getByText(/1,000 ai generations a month/i)).toBeInTheDocument();
    expect(screen.getByText(/bring your own anthropic key/i)).toBeInTheDocument();
    expect(screen.getByText(/schema markup generation/i)).toBeInTheDocument();

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(screen.getByText("$5")).toBeInTheDocument();
    expect(screen.getByText("$50")).toBeInTheDocument();
  });

  it("starts checkout with the selected plan", async () => {
    const user = userEvent.setup();
    render(<PaywallModal />);

    await user.click(screen.getByRole("radio", { name: /annual/i }));
    await user.click(screen.getByRole("button", { name: /continue to checkout/i }));

    expect(startCheckoutMock).toHaveBeenCalledWith("annual");
  });

  it("moves focus into the dialog and closes on Escape", async () => {
    const user = userEvent.setup();
    render(<PaywallModal />);

    const dialog = screen.getByRole("dialog", { name: /optia pro/i });
    expect(dialog.contains(document.activeElement)).toBe(true);

    await user.keyboard("{Escape}");
    expect(useCheckoutStore.getState().paywallOpen).toBe(false);
  });

  it("shows the over-quota usage line when opened from the quota prompt", () => {
    useEntitlementStore.setState({ freeAiLimit: 25, freeAiRemaining: 0 });
    useCheckoutStore.setState({ trigger: "quota" });
    render(<PaywallModal />);

    expect(screen.getByText(/used all 25 free ai generations/i)).toBeInTheDocument();
  });

  it("renders nothing for Pro users", () => {
    useEntitlementStore.setState({ isPro: true });
    render(<PaywallModal />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the waiting state while polling for payment confirmation", () => {
    useCheckoutStore.setState({ phase: "polling" });
    render(<PaywallModal />);

    expect(screen.getByText(/waiting for payment confirmation/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("celebrates and closes from the success state", async () => {
    useCheckoutStore.setState({ phase: "success" });
    const user = userEvent.setup();
    render(<PaywallModal />);

    expect(screen.getByText(/you're on pro/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /done/i }));
    expect(useCheckoutStore.getState().paywallOpen).toBe(false);
  });

  it("shows the error with a retry action", () => {
    useCheckoutStore.setState({ phase: "error", error: "Could not start checkout. Please try again." });
    render(<PaywallModal />);

    expect(screen.getByRole("alert")).toHaveTextContent(/could not start checkout/i);
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
