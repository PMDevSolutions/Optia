import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Options } from "./Options";
import { useEntitlementStore } from "@/lib/entitlement-store";
import {
  activate,
  deactivate,
  getAiQuotaRemaining,
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
    getAiQuotaRemaining: vi.fn(),
    hasStoredLicenseKey: vi.fn(),
    consumeAiQuota: vi.fn(),
  };
});

const activateMock = vi.mocked(activate);
const deactivateMock = vi.mocked(deactivate);
const getValidEntitlementMock = vi.mocked(getValidEntitlement);
const getAiQuotaRemainingMock = vi.mocked(getAiQuotaRemaining);
const hasStoredLicenseKeyMock = vi.mocked(hasStoredLicenseKey);

const proClaims: EntitlementClaims = {
  sub: "lic_1",
  subjectType: "license",
  tier: "pro",
  quotaLimit: 100,
  period: "2026-07",
  exp: Math.floor(Date.now() / 1000) + 3600,
};

describe("Options page", () => {
  beforeEach(() => {
    // Reset chrome.storage mock between tests
    (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
      () => Promise.resolve({}),
    );
    getValidEntitlementMock.mockResolvedValue(null);
    getAiQuotaRemainingMock.mockResolvedValue(0);
    hasStoredLicenseKeyMock.mockResolvedValue(false);
    useEntitlementStore.setState({
      entitlementLoaded: false,
      isPro: false,
      tier: "free",
      expiresAt: null,
      quotaLimit: 0,
      aiQuotaRemaining: 0,
      canUseAdvancedOptions: false,
      hasLicenseKey: false,
      activating: false,
      activationError: null,
    });
  });

  // --- Rendering ---

  it("renders the settings heading", () => {
    render(<Options />);
    expect(
      screen.getByRole("heading", { name: /settings/i }),
    ).toBeInTheDocument();
  });

  it("renders the OpenAI API key field", () => {
    render(<Options />);
    expect(screen.getByLabelText(/openai api key/i)).toBeInTheDocument();
  });

  it("renders the default language select", () => {
    render(<Options />);
    expect(
      screen.getByLabelText(/default language/i),
    ).toBeInTheDocument();
  });

  it("renders a save button", () => {
    render(<Options />);
    expect(
      screen.getByRole("button", { name: /save/i }),
    ).toBeInTheDocument();
  });

  // --- Loading saved values ---

  it("loads saved API key from chrome.storage on mount", async () => {
    (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        Promise.resolve({
          openai_api_key: "sk-test-key-123",
          default_language: "en",
        }),
    );

    render(<Options />);

    await waitFor(() => {
      expect(screen.getByLabelText(/openai api key/i)).toHaveValue(
        "sk-test-key-123",
      );
    });
  });

  it("loads saved language from chrome.storage on mount", async () => {
    (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        Promise.resolve({
          openai_api_key: "",
          default_language: "fr",
        }),
    );

    render(<Options />);

    await waitFor(() => {
      expect(screen.getByLabelText(/default language/i)).toHaveValue("fr");
    });
  });

  // --- User interactions ---

  it("allows typing an API key", async () => {
    const user = userEvent.setup();
    render(<Options />);

    const input = screen.getByLabelText(/openai api key/i);
    await user.clear(input);
    await user.type(input, "sk-new-key");

    expect(input).toHaveValue("sk-new-key");
  });

  it("allows selecting a language", async () => {
    const user = userEvent.setup();
    render(<Options />);

    const select = screen.getByLabelText(/default language/i);
    await user.selectOptions(select, "de");

    expect(select).toHaveValue("de");
  });

  it("saves settings to chrome.storage when save is clicked", async () => {
    const user = userEvent.setup();
    render(<Options />);

    const input = screen.getByLabelText(/openai api key/i);
    await user.clear(input);
    await user.type(input, "sk-saved-key");

    const select = screen.getByLabelText(/default language/i);
    await user.selectOptions(select, "es");

    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        openai_api_key: "sk-saved-key",
        default_language: "es",
      }),
    );
  });

  it("shows a success message after saving", async () => {
    const user = userEvent.setup();
    render(<Options />);

    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/saved/i)).toBeInTheDocument();
    });
  });

  // --- Accessibility ---

  it("API key input has password type for security", () => {
    render(<Options />);
    expect(screen.getByLabelText(/openai api key/i)).toHaveAttribute(
      "type",
      "password",
    );
  });

  it("all form controls have associated labels", () => {
    render(<Options />);
    // These will throw if no label is associated
    expect(screen.getByLabelText(/openai api key/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/default language/i)).toBeInTheDocument();
  });

  // --- License card ---

  it("shows the free state with a license key input and Activate button", async () => {
    render(<Options />);

    expect(screen.getByRole("heading", { name: /license/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Free")).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/license key/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^activate$/i })).toBeDisabled();
  });

  it("activates a license key and switches to the Pro state", async () => {
    const user = userEvent.setup();
    activateMock.mockImplementation(async () => {
      getValidEntitlementMock.mockResolvedValue(proClaims);
      getAiQuotaRemainingMock.mockResolvedValue(100);
      hasStoredLicenseKeyMock.mockResolvedValue(true);
      return proClaims;
    });
    render(<Options />);

    await user.type(screen.getByLabelText(/license key/i), "optia_live_abc");
    await user.click(screen.getByRole("button", { name: /^activate$/i }));

    expect(activateMock).toHaveBeenCalledWith("optia_live_abc");
    await waitFor(() => {
      expect(screen.getByText("Pro")).toBeInTheDocument();
    });
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
    getValidEntitlementMock.mockResolvedValue(proClaims);
    getAiQuotaRemainingMock.mockResolvedValue(80);
    hasStoredLicenseKeyMock.mockResolvedValue(true);
    deactivateMock.mockResolvedValue();
    render(<Options />);

    await waitFor(() => {
      expect(screen.getByText("Pro")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /deactivate/i }));

    expect(deactivateMock).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText("Free")).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/license key/i)).toBeInTheDocument();
  });
});
