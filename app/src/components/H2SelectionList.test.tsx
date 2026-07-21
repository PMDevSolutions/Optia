import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { H2SelectionList } from "./H2SelectionList";

beforeEach(() => {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });
});

describe("H2SelectionList", () => {
  const items = [
    { index: 0, text: "Introduction", suggestion: "" },
    { index: 1, text: "Features", suggestion: "Top Features" },
  ];

  const defaultProps = {
    items,
    onRegenerateOne: vi.fn().mockResolvedValue("Better heading"),
    onRegenerateAll: vi.fn().mockResolvedValue(["New Intro", "New Features"]),
    onToast: vi.fn(),
  };

  it("renders all H2 items with their text", () => {
    render(<H2SelectionList {...defaultProps} />);
    expect(screen.getByText("Introduction")).toBeInTheDocument();
    expect(screen.getByText("Features")).toBeInTheDocument();
  });

  it("shows 'H2 Heading Suggestions' label", () => {
    render(<H2SelectionList {...defaultProps} />);
    expect(screen.getByText("H2 Heading Suggestions")).toBeInTheDocument();
  });

  it("renders the 'Generate All' button", () => {
    render(<H2SelectionList {...defaultProps} />);
    expect(screen.getByText("Generate All")).toBeInTheDocument();
  });

  it("calls onRegenerateOne when per-item regenerate is clicked", async () => {
    const user = userEvent.setup();
    render(<H2SelectionList {...defaultProps} />);
    const regenerateButtons = screen.getAllByTitle("Regenerate");
    await user.click(regenerateButtons[0]);
    expect(defaultProps.onRegenerateOne).toHaveBeenCalledWith(0, "Introduction");
  });

  it("calls onRegenerateAll when Generate All is clicked", async () => {
    const user = userEvent.setup();
    render(<H2SelectionList {...defaultProps} />);
    await user.click(screen.getByText("Generate All"));
    expect(defaultProps.onRegenerateAll).toHaveBeenCalled();
  });

  it("disables copy button when there is no suggestion", () => {
    render(<H2SelectionList {...defaultProps} />);
    const copyButtons = screen.getAllByTitle("Copy");
    expect(copyButtons[0]).toBeDisabled();
  });

  it("enables copy and copies text when suggestion exists", async () => {
    const user = userEvent.setup();
    render(<H2SelectionList {...defaultProps} />);
    const copyButtons = screen.getAllByTitle("Copy");
    expect(copyButtons[1]).not.toBeDisabled();
    await user.click(copyButtons[1]);
    const clipboardText = await navigator.clipboard.readText();
    expect(clipboardText).toBe("Top Features");
  });

  it("allows editing the textarea for each item", async () => {
    const user = userEvent.setup();
    render(<H2SelectionList {...defaultProps} />);
    const textareas = screen.getAllByRole("textbox");
    await user.clear(textareas[0]);
    await user.type(textareas[0], "Edited heading");
    expect(textareas[0]).toHaveValue("Edited heading");
  });

  it("shows 'Generate All' button text", () => {
    render(<H2SelectionList {...defaultProps} />);
    expect(screen.getByText("Generate All")).toBeInTheDocument();
  });

  it("calls onToast with 'Failed to regenerate' on per-item failure", async () => {
    const user = userEvent.setup();
    const onRegenerateOne = vi.fn().mockRejectedValue(new Error("fail"));
    render(
      <H2SelectionList {...defaultProps} onRegenerateOne={onRegenerateOne} />,
    );
    const regenerateButtons = screen.getAllByTitle("Regenerate");
    await user.click(regenerateButtons[0]);
    expect(defaultProps.onToast).toHaveBeenCalledWith("Failed to regenerate");
  });

  describe("when aiDisabled is true", () => {
    it("disables the Generate All button", () => {
      render(<H2SelectionList {...defaultProps} aiDisabled />);
      const generateAllBtn = screen.getByText("Generate All").closest("button")!;
      expect(generateAllBtn).toBeDisabled();
    });

    it("disables all per-item regenerate buttons", () => {
      render(<H2SelectionList {...defaultProps} aiDisabled />);
      const regenerateButtons = screen.getAllByTitle("Activate Optia Pro or add your own Anthropic key in options");
      for (const btn of regenerateButtons) {
        expect(btn).toBeDisabled();
      }
    });

    it("shows a message about setting up the API key", () => {
      render(<H2SelectionList {...defaultProps} aiDisabled />);
      expect(
        screen.getByText("Activate Optia Pro or add your own Anthropic key in options to use AI suggestions."),
      ).toBeInTheDocument();
    });

    it("does not call onRegenerateAll when Generate All is clicked", async () => {
      const onRegenerateAll = vi.fn();
      const user = userEvent.setup();
      render(
        <H2SelectionList
          {...defaultProps}
          onRegenerateAll={onRegenerateAll}
          aiDisabled
        />,
      );
      const generateAllBtn = screen.getByText("Generate All").closest("button")!;
      await user.click(generateAllBtn);
      expect(onRegenerateAll).not.toHaveBeenCalled();
    });
  });
});
