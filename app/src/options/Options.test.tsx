import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Options } from "./Options";
import { useEntitlementStore } from "@/lib/entitlement-store";
import {
  activate,
  deactivate,
  getFreeAiQuota,
  getProAiRemaining,
  getValidEntitlement,
  hasStoredLicenseKey,
  type EntitlementClaims,
} from "@/lib/entitlement";
import { LicenseError } from "@/lib/backend";

vi.mock("@/lib/entitlement", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/entitlement")>();
  return {
    ...original,
    activate: vi.fn(),
    deactivate: vi.fn(),
    getValidEntitlement: vi.fn(),
    getFreeAiQuota: vi.fn(),
    getProAiRemaining: vi.fn(),
    hasStoredLicenseKey: vi.fn(),
    recordProAiQuota: vi.fn(),
    recordFreeAiQuota: vi.fn(),
  };
});

const activateMock = vi.mocked(activate);
const deactivateMock = vi.mocked(deactivate);
const getValidEntitlementMock = vi.mocked(getValidEntitlement);
const getFreeAiQuotaMock = vi.mocked(getFreeAiQuota);
const getProAiRemainingMock = vi.mocked(getProAiRemaining);
const hasStoredLicenseKeyMock = vi.mocked(hasStoredLicenseKey);

const proClaims: EntitlementClaims = {
  sub: "lic_1",
  subjectType: "license",
  tier: "pro",
  quotaLimit: 100,
  period: "2026-07",
  exp: Math.floor(Date.now() / 1000) + 3600,
};

function resetEntitlementState() {
  useEntitlementStore.setState({
    entitlementLoaded: false,
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
    activating: false,
    activationError: null,
  });
}

/** Makes hydrateEntitlement resolve to a Pro entitlement (all canUse* true). */
function mockPro(remaining = 100) {
  getValidEntitlementMock.mockResolvedValue(proClaims);
  getProAiRemainingMock.mockResolvedValue(remaining);
  hasStoredLicenseKeyMock.mockResolvedValue(true);
}

describe("Options page", () => {
  beforeEach(() => {
    (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve({}),
    );
    getValidEntitlementMock.mockResolvedValue(null);
    getFreeAiQuotaMock.mockResolvedValue(null);
    getProAiRemainingMock.mockResolvedValue(0);
    hasStoredLicenseKeyMock.mockResolvedValue(false);
    resetEntitlementState();
  });

  // --- Rendering ---

  it("renders the settings heading", () => {
    render(<Options />);
    expect(screen.getByRole("heading", { name: /settings/i })).toBeInTheDocument();
  });

  it("renders the default language control and a save button", () => {
    render(<Options />);
    expect(screen.getByLabelText(/default language/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
  });

  // --- Free tier gating ---

  it("hides the Anthropic API key input for free users (Pro upsell instead)", async () => {
    render(<Options />);
    await waitFor(() => expect(screen.getByText("Free")).toBeInTheDocument());

    expect(screen.queryByLabelText(/anthropic api key/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/bring your own anthropic key with optia pro/i),
    ).toBeInTheDocument();
  });

  it("disables the language select and pins English for free users", async () => {
    (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve({ default_language: "fr" }),
    );
    render(<Options />);
    await waitFor(() => expect(screen.getByText("Free")).toBeInTheDocument());

    const select = screen.getByLabelText(/default language/i);
    expect(select).toBeDisabled();
    expect(select).toHaveValue("en");
  });

  it("saves only the language (English) for free users, never a key", async () => {
    const user = userEvent.setup();
    render(<Options />);
    await waitFor(() => expect(screen.getByText("Free")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(chrome.storage.local.set).toHaveBeenCalledWith({ default_language: "en" });
    const call = (chrome.storage.local.set as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call).not.toHaveProperty("anthropic_api_key");
  });

  // --- Pro tier ---

  it("renders the Anthropic API key input (password) for Pro users", async () => {
    mockPro();
    render(<Options />);

    await waitFor(() => {
      expect(screen.getByLabelText(/anthropic api key/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/anthropic api key/i)).toHaveAttribute("type", "password");
    expect(screen.getByLabelText(/default language/i)).toBeEnabled();
  });

  it("loads a saved Anthropic key and language for Pro users", async () => {
    mockPro();
    (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve({ anthropic_api_key: "sk-ant-123", default_language: "de" }),
    );
    render(<Options />);

    await waitFor(() => {
      expect(screen.getByLabelText(/anthropic api key/i)).toHaveValue("sk-ant-123");
    });
    expect(screen.getByLabelText(/default language/i)).toHaveValue("de");
  });

  it("saves the Anthropic key and language for Pro users", async () => {
    mockPro();
    const user = userEvent.setup();
    render(<Options />);
    await waitFor(() => expect(screen.getByLabelText(/anthropic api key/i)).toBeInTheDocument());

    await user.type(screen.getByLabelText(/anthropic api key/i), "sk-ant-saved");
    await user.selectOptions(screen.getByLabelText(/default language/i), "es");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        anthropic_api_key: "sk-ant-saved",
        default_language: "es",
      }),
    );
  });

  it("shows a success message after saving", async () => {
    const user = userEvent.setup();
    render(<Options />);
    await user.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(screen.getByText(/saved/i)).toBeInTheDocument());
  });

  // --- License card ---

  it("shows the free state with a license key input and Activate button", async () => {
    render(<Options />);

    expect(screen.getByRole("heading", { name: /license/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Free")).toBeInTheDocument());
    expect(screen.getByLabelText(/license key/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^activate$/i })).toBeDisabled();
  });

  it("activates a license key and switches to the Pro state", async () => {
    const user = userEvent.setup();
    activateMock.mockImplementation(async () => {
      mockPro(100);
      return proClaims;
    });
    render(<Options />);

    await user.type(screen.getByLabelText(/license key/i), "optia_live_abc");
    await user.click(screen.getByRole("button", { name: /^activate$/i }));

    expect(activateMock).toHaveBeenCalledWith("optia_live_abc");
    await waitFor(() => expect(screen.getByText("Pro")).toBeInTheDocument());
    expect(screen.getByText(/100 of 100 remaining/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /deactivate/i })).toBeInTheDocument();
  });

  it("shows an activation error for an invalid key and stays free", async () => {
    const user = userEvent.setup();
    activateMock.mockRejectedValue(new LicenseError("invalid", "This license key is not valid."));
    render(<Options />);

    await user.type(screen.getByLabelText(/license key/i), "bad-key");
    await user.click(screen.getByRole("button", { name: /^activate$/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("This license key is not valid.");
    });
    expect(screen.getByText("Free")).toBeInTheDocument();
  });

  it("deactivates and returns to the free state", async () => {
    const user = userEvent.setup();
    mockPro(80);
    deactivateMock.mockImplementation(async () => {
      // After deactivation the entitlement is gone; next hydrate resolves free.
      getValidEntitlementMock.mockResolvedValue(null);
      hasStoredLicenseKeyMock.mockResolvedValue(false);
    });
    render(<Options />);

    await waitFor(() => expect(screen.getByText("Pro")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /deactivate/i }));

    expect(deactivateMock).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText("Free")).toBeInTheDocument());
    expect(screen.getByLabelText(/license key/i)).toBeInTheDocument();
  });
});
