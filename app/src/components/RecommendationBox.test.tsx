import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecommendationBox } from "./RecommendationBox";

beforeEach(() => {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });
});

describe("RecommendationBox", () => {
  const defaultProps = {
    label: "Meta Description",
    value: "A great page description",
    onRegenerate: vi.fn().mockResolvedValue("New description"),
    onToast: vi.fn(),
  };

  it("renders the label", () => {
    render(<RecommendationBox {...defaultProps} />);
    expect(screen.getByText("Meta Description")).toBeInTheDocument();
  });

  it("renders the value text", () => {
    render(<RecommendationBox {...defaultProps} />);
    expect(screen.getByText("A great page description")).toBeInTheDocument();
  });

  it("copies text to clipboard when copy button is clicked", async () => {
    const user = userEvent.setup();
    render(<RecommendationBox {...defaultProps} />);
    await user.click(screen.getByTitle("Copy"));
    const clipboardText = await navigator.clipboard.readText();
    expect(clipboardText).toBe("A great page description");
  });

  it("calls onToast with 'Copied to clipboard' after copy", async () => {
    const user = userEvent.setup();
    render(<RecommendationBox {...defaultProps} />);
    await user.click(screen.getByTitle("Copy"));
    expect(defaultProps.onToast).toHaveBeenCalledWith("Copied to clipboard");
  });

  it("updates text with regenerated value", async () => {
    const user = userEvent.setup();
    render(<RecommendationBox {...defaultProps} />);
    await user.click(screen.getByTitle("Regenerate"));
    expect(screen.getByText("New description")).toBeInTheDocument();
  });

  it("calls onToast with 'Failed to regenerate' on failure", async () => {
    const user = userEvent.setup();
    const onRegenerate = vi.fn().mockRejectedValue(new Error("API error"));
    render(<RecommendationBox {...defaultProps} onRegenerate={onRegenerate} />);
    await user.click(screen.getByTitle("Regenerate"));
    expect(defaultProps.onToast).toHaveBeenCalledWith("Failed to regenerate");
  });

  describe("when aiDisabled is true", () => {
    it("disables the regenerate button", () => {
      render(<RecommendationBox {...defaultProps} aiDisabled />);
      const btn = screen.getByTitle("Activate Optia Pro or add your own Anthropic key in options");
      expect(btn).toBeDisabled();
    });

    it("shows a message about setting up the API key", () => {
      render(<RecommendationBox {...defaultProps} aiDisabled />);
      expect(
        screen.getByText("Activate Optia Pro or add your own Anthropic key in options to use AI suggestions."),
      ).toBeInTheDocument();
    });

    it("does not call onRegenerate when button is clicked", async () => {
      const onRegenerate = vi.fn();
      const user = userEvent.setup();
      render(
        <RecommendationBox {...defaultProps} onRegenerate={onRegenerate} aiDisabled />,
      );
      const btn = screen.getByTitle("Activate Optia Pro or add your own Anthropic key in options");
      await user.click(btn);
      expect(onRegenerate).not.toHaveBeenCalled();
    });
  });
});
