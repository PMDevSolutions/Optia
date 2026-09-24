import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditableRecommendation } from "./EditableRecommendation";

beforeEach(() => {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });
});

describe("EditableRecommendation", () => {
  const defaultProps = {
    label: "Meta Title",
    initialValue: "My SEO Title",
    onRegenerate: vi.fn().mockResolvedValue("Regenerated title"),
    onToast: vi.fn(),
  };

  it("renders the label text", () => {
    render(<EditableRecommendation {...defaultProps} />);
    expect(screen.getByText("Meta Title")).toBeInTheDocument();
  });

  it("renders initialValue in textarea", () => {
    render(<EditableRecommendation {...defaultProps} />);
    expect(screen.getByRole("textbox")).toHaveValue("My SEO Title");
  });

  it("allows editing the textarea", async () => {
    const user = userEvent.setup();
    render(<EditableRecommendation {...defaultProps} />);
    const textarea = screen.getByRole("textbox");
    await user.clear(textarea);
    await user.type(textarea, "New title");
    expect(textarea).toHaveValue("New title");
  });

  it("copies text to clipboard when copy button is clicked", async () => {
    const user = userEvent.setup();
    render(<EditableRecommendation {...defaultProps} />);
    await user.click(screen.getByTitle("Copy to clipboard"));
    const clipboardText = await navigator.clipboard.readText();
    expect(clipboardText).toBe("My SEO Title");
  });

  it("calls onToast with 'Copied to clipboard' after copy", async () => {
    const user = userEvent.setup();
    render(<EditableRecommendation {...defaultProps} />);
    await user.click(screen.getByTitle("Copy to clipboard"));
    expect(defaultProps.onToast).toHaveBeenCalledWith("Copied to clipboard");
  });

  it("updates text with regenerated value", async () => {
    const user = userEvent.setup();
    render(<EditableRecommendation {...defaultProps} />);
    await user.click(screen.getByTitle("Regenerate"));
    expect(screen.getByRole("textbox")).toHaveValue("Regenerated title");
  });

  it("calls onToast with 'Recommendation regenerated' after regenerate", async () => {
    const user = userEvent.setup();
    render(<EditableRecommendation {...defaultProps} />);
    await user.click(screen.getByTitle("Regenerate"));
    expect(defaultProps.onToast).toHaveBeenCalledWith("Recommendation regenerated");
  });

  it("calls onToast with 'Failed to regenerate' on regenerate failure", async () => {
    const user = userEvent.setup();
    const onRegenerate = vi.fn().mockRejectedValue(new Error("API error"));
    render(
      <EditableRecommendation {...defaultProps} onRegenerate={onRegenerate} />,
    );
    await user.click(screen.getByTitle("Regenerate"));
    expect(defaultProps.onToast).toHaveBeenCalledWith("Failed to regenerate");
  });

  describe("when aiDisabled is true", () => {
    it("disables the regenerate button", () => {
      render(<EditableRecommendation {...defaultProps} aiDisabled />);
      const btn = screen.getByTitle("Activate Optia Pro or add your own Anthropic key in options");
      expect(btn).toBeDisabled();
    });

    it("shows a message about setting up the API key", () => {
      render(<EditableRecommendation {...defaultProps} aiDisabled />);
      expect(
        screen.getByText("Activate Optia Pro or add your own Anthropic key in options to use AI suggestions."),
      ).toBeInTheDocument();
    });

    it("does not call onRegenerate when button is clicked", async () => {
      const onRegenerate = vi.fn();
      const user = userEvent.setup();
      render(
        <EditableRecommendation {...defaultProps} onRegenerate={onRegenerate} aiDisabled />,
      );
      const btn = screen.getByTitle("Activate Optia Pro or add your own Anthropic key in options");
      await user.click(btn);
      expect(onRegenerate).not.toHaveBeenCalled();
    });
  });
});

describe("EditableRecommendation inline failure message", () => {
  const defaultProps = {
    label: "Meta Title",
    initialValue: "My SEO Title",
    onRegenerate: vi.fn().mockResolvedValue("Regenerated title"),
    onToast: vi.fn(),
  };

  it("shows no failure message initially", () => {
    render(<EditableRecommendation {...defaultProps} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps the failure visible in the box after a failed regenerate", async () => {
    const user = userEvent.setup();
    const onRegenerate = vi.fn().mockRejectedValue(new Error("API error"));
    render(<EditableRecommendation {...defaultProps} onRegenerate={onRegenerate} />);

    await user.click(screen.getByTitle("Regenerate"));

    expect(screen.getByRole("alert")).toHaveTextContent("Failed to regenerate");
    // The box keeps whatever text it had; the message is what signals the failure.
    expect(screen.getByRole("textbox")).toHaveValue("My SEO Title");
  });

  it("surfaces the AI service's own message when it explains the failure", async () => {
    const user = userEvent.setup();
    const quota = Object.assign(new Error("AI quota reached."), { name: "AiProxyError" });
    const onRegenerate = vi.fn().mockRejectedValue(quota);
    render(<EditableRecommendation {...defaultProps} onRegenerate={onRegenerate} />);

    await user.click(screen.getByTitle("Regenerate"));

    expect(screen.getByRole("alert")).toHaveTextContent("AI quota reached.");
  });

  it("clears the failure once a later regenerate succeeds", async () => {
    const user = userEvent.setup();
    const onRegenerate = vi
      .fn()
      .mockRejectedValueOnce(new Error("API error"))
      .mockResolvedValueOnce("Regenerated title");
    render(<EditableRecommendation {...defaultProps} onRegenerate={onRegenerate} />);

    await user.click(screen.getByTitle("Regenerate"));
    expect(screen.getByRole("alert")).toBeInTheDocument();

    await user.click(screen.getByTitle("Regenerate"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("Regenerated title");
  });

  it("clears the failure when a new suggestion arrives from the parent", async () => {
    const user = userEvent.setup();
    const onRegenerate = vi.fn().mockRejectedValue(new Error("API error"));
    const { rerender } = render(
      <EditableRecommendation {...defaultProps} onRegenerate={onRegenerate} />,
    );

    await user.click(screen.getByTitle("Regenerate"));
    expect(screen.getByRole("alert")).toBeInTheDocument();

    rerender(
      <EditableRecommendation
        {...defaultProps}
        onRegenerate={onRegenerate}
        initialValue="Fresh suggestion"
      />,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("Fresh suggestion");
  });
});
