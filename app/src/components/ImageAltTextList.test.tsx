import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImageAltTextList } from "./ImageAltTextList";

beforeEach(() => {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });
});

describe("ImageAltTextList", () => {
  const images = [
    { src: "https://example.com/hero.jpg", alt: "", width: 800, height: 600 },
    { src: "https://example.com/logo.png", alt: "", width: 200, height: 100 },
  ];

  const defaultProps = {
    images,
    onGenerate: vi.fn().mockResolvedValue("A scenic mountain view"),
    onToast: vi.fn(),
  };

  it("returns null for empty images array", () => {
    const { container } = render(
      <ImageAltTextList {...defaultProps} images={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders all images", () => {
    render(<ImageAltTextList {...defaultProps} />);
    const imgs = screen.getAllByRole("img");
    expect(imgs).toHaveLength(2);
  });

  it("shows 'Images Missing Alt Text' header", () => {
    render(<ImageAltTextList {...defaultProps} />);
    expect(screen.getByText("Images Missing Alt Text")).toBeInTheDocument();
  });

  it("calls onGenerate with correct src when generate button is clicked", async () => {
    const user = userEvent.setup();
    render(<ImageAltTextList {...defaultProps} />);
    const generateButtons = screen.getAllByTitle("Generate alt text");
    await user.click(generateButtons[0]);
    expect(defaultProps.onGenerate).toHaveBeenCalledWith(
      "https://example.com/hero.jpg",
    );
  });

  it("displays generated text in input after generation", async () => {
    const user = userEvent.setup();
    render(<ImageAltTextList {...defaultProps} />);
    const generateButtons = screen.getAllByTitle("Generate alt text");
    await user.click(generateButtons[0]);
    const inputs = screen.getAllByPlaceholderText("Generate or type alt text...");
    expect(inputs[0]).toHaveValue("A scenic mountain view");
  });

  it("disables copy button when no alt text exists", () => {
    render(<ImageAltTextList {...defaultProps} />);
    const copyButtons = screen.getAllByTitle("Copy");
    expect(copyButtons[0]).toBeDisabled();
  });

  it("allows editing the input field", async () => {
    const user = userEvent.setup();
    render(<ImageAltTextList {...defaultProps} />);
    const inputs = screen.getAllByPlaceholderText("Generate or type alt text...");
    await user.type(inputs[0], "Custom alt text");
    expect(inputs[0]).toHaveValue("Custom alt text");
  });

  it("calls onToast with failure message on generate error", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn().mockRejectedValue(new Error("fail"));
    render(<ImageAltTextList {...defaultProps} onGenerate={onGenerate} />);
    const generateButtons = screen.getAllByTitle("Generate alt text");
    await user.click(generateButtons[0]);
    expect(defaultProps.onToast).toHaveBeenCalledWith(
      "Failed to generate alt text",
    );
  });

  describe("when aiDisabled is true", () => {
    it("disables all generate buttons", () => {
      render(<ImageAltTextList {...defaultProps} aiDisabled />);
      const generateButtons = screen.getAllByTitle("Add an OpenAI API key or activate Optia Pro in options");
      for (const btn of generateButtons) {
        expect(btn).toBeDisabled();
      }
    });

    it("shows a message about setting up the API key", () => {
      render(<ImageAltTextList {...defaultProps} aiDisabled />);
      expect(
        screen.getByText("Add your OpenAI API key or activate Optia Pro in options to use AI suggestions."),
      ).toBeInTheDocument();
    });

    it("does not call onGenerate when generate button is clicked", async () => {
      const onGenerate = vi.fn();
      const user = userEvent.setup();
      render(
        <ImageAltTextList {...defaultProps} onGenerate={onGenerate} aiDisabled />,
      );
      const generateButtons = screen.getAllByTitle("Add an OpenAI API key or activate Optia Pro in options");
      await user.click(generateButtons[0]);
      expect(onGenerate).not.toHaveBeenCalled();
    });
  });
});
