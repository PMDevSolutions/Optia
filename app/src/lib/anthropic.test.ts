import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AI_MODEL,
  generateRecommendationDirect,
  generateH2SuggestionDirect,
  generateAltTextDirect,
} from "@/lib/anthropic";

// A module-scoped mock for `client.messages.create`, driven per-test. Hoisted so
// the vi.mock factory below (which is hoisted above imports) can close over it.
const createMock = vi.hoisted(() => vi.fn());

// Replace the SDK's default export with a constructor that hands back a client
// whose messages.create is our controllable mock. The constructor args
// (apiKey/dangerouslyAllowBrowser/baseURL) are irrelevant here since the network
// is never touched.
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: createMock },
  })),
}));

/** Build a mock Anthropic Message whose text block carries `text`. */
function textMessage(text: string) {
  return { content: [{ type: "text", text }] };
}

/** Grab the single argument object passed to the most recent create() call. */
function lastCreateArgs() {
  return createMock.mock.calls[createMock.mock.calls.length - 1][0] as {
    model: string;
    max_tokens: number;
    system: string;
    messages: { role: string; content: string }[];
  };
}

beforeEach(() => {
  createMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("generateRecommendationDirect", () => {
  it("returns the model text for a copyable check and strips wrapping quotes", async () => {
    // Model wraps its answer in quotes the way it sometimes does.
    createMock.mockResolvedValue(textMessage('"Best Running Shoes for Trail Runners"'));

    const result = await generateRecommendationDirect(
      "sk-test",
      "title-keyword",
      "running shoes",
      "Old Title",
    );

    expect(result).toBe("Best Running Shoes for Trail Runners");

    const args = lastCreateArgs();
    expect(createMock).toHaveBeenCalledTimes(1);
    // The copyable branch uses the "ready-to-use content" system prompt.
    expect(args.system).toContain("ready-to-use content");
    expect(args.messages[0].content).toContain('perfect SEO title for the keyphrase "running shoes"');
  });

  it("passes the Opus 4.8 model and the 1024 max_tokens budget", async () => {
    createMock.mockResolvedValue(textMessage("Something"));

    await generateRecommendationDirect("sk-test", "title-keyword", "kw", "ctx");

    expect(AI_MODEL).toBe("claude-opus-4-8");
    const args = lastCreateArgs();
    expect(args.model).toBe("claude-opus-4-8");
    expect(args.max_tokens).toBe(1024);
    expect(args.messages[0].role).toBe("user");
  });

  it("uses the advisory system prompt for a non-listed checkId", async () => {
    createMock.mockResolvedValue(textMessage("Add descriptive internal links throughout the page."));

    const result = await generateRecommendationDirect(
      "sk-test",
      "some-unknown-check",
      "running shoes",
      "current status here",
    );

    expect(result).toBe("Add descriptive internal links throughout the page.");

    const args = lastCreateArgs();
    // Default branch => advisory ("actionable advice") system prompt, not copyable.
    expect(args.system).toContain("actionable advice");
    expect(args.system).not.toContain("ready-to-use content");
    expect(args.messages[0].content).toContain('Fix this SEO issue: "some-unknown-check"');
  });

  it("reads the first text block even when a non-text block precedes it", async () => {
    createMock.mockResolvedValue({
      content: [
        { type: "thinking", thinking: "reasoning..." },
        { type: "text", text: "The Final Title" },
      ],
    });

    const result = await generateRecommendationDirect("sk-test", "title-keyword", "kw", "ctx");

    expect(result).toBe("The Final Title");
  });
});

describe("generateH2SuggestionDirect", () => {
  it("returns the generated H2 heading text", async () => {
    createMock.mockResolvedValue(textMessage("Choosing the Best Running Shoes"));

    const result = await generateH2SuggestionDirect(
      "sk-test",
      "Old Heading",
      "running shoes",
    );

    expect(result).toBe("Choosing the Best Running Shoes");

    const args = lastCreateArgs();
    expect(args.model).toBe("claude-opus-4-8");
    expect(args.system).toContain("H2 heading");
    expect(args.messages[0].content).toContain('perfect H2 heading for the keyphrase "running shoes"');
    expect(args.messages[0].content).toContain('Current H2: "Old Heading"');
  });
});

describe("generateAltTextDirect", () => {
  it("returns the alt text and derives the filename from the image URL", async () => {
    createMock.mockResolvedValue(textMessage("Trail running shoes on a rocky path"));

    const result = await generateAltTextDirect(
      "sk-test",
      "https://cdn.example.com/assets/trail-shoes.jpg?v=2",
      "running shoes",
    );

    expect(result).toBe("Trail running shoes on a rocky path");

    const args = lastCreateArgs();
    expect(args.model).toBe("claude-opus-4-8");
    expect(args.system).toContain("accessibility expert");
    // Query string stripped, path removed: bare filename in the prompt.
    expect(args.messages[0].content).toContain("Image filename: trail-shoes.jpg");
    expect(args.messages[0].content).toContain(
      "https://cdn.example.com/assets/trail-shoes.jpg?v=2",
    );
  });
});

describe("advancedOptions shape the prompt", () => {
  it("injects language, page type, and secondary keyword context", async () => {
    createMock.mockResolvedValue(textMessage("Meilleures Chaussures de Course"));

    await generateRecommendationDirect(
      "sk-test",
      "title-keyword",
      "chaussures de course",
      "Ancien titre",
      {
        pageType: "product-page",
        secondaryKeywords: "chaussures de trail, running",
        languageCode: "fr",
      },
    );

    const args = lastCreateArgs();
    // French language instruction lives in the system prompt.
    expect(args.system).toContain("Generate all content in French (Français)");
    // Advanced context and the humanized page type live in the user prompt.
    expect(args.messages[0].content).toContain("Advanced Context:");
    expect(args.messages[0].content).toContain("Page Type: product-page");
    expect(args.messages[0].content).toContain("Secondary Keywords: chaussures de trail, running");
    expect(args.messages[0].content).toContain("for a product page");
  });

  it("adds no language instruction for English (the default)", async () => {
    createMock.mockResolvedValue(textMessage("A Title"));

    await generateRecommendationDirect("sk-test", "title-keyword", "kw", "ctx", {
      languageCode: "en",
    });

    const args = lastCreateArgs();
    expect(args.system).not.toContain("Generate all content in");
    expect(args.messages[0].content).not.toContain("Advanced Context:");
  });
});

describe("completeWithRetry behavior", () => {
  it("throws a 401 immediately without retrying", async () => {
    createMock.mockRejectedValue(Object.assign(new Error("Unauthorized"), { status: 401 }));

    await expect(
      generateRecommendationDirect("sk-bad", "title-keyword", "kw", "ctx"),
    ).rejects.toThrow("Unauthorized");

    // Auth failures short-circuit: exactly one attempt.
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("retries a transient error and then succeeds", async () => {
    vi.useFakeTimers();
    createMock
      .mockRejectedValueOnce(Object.assign(new Error("Server Error"), { status: 500 }))
      .mockResolvedValueOnce(textMessage("Recovered Title"));

    const promise = generateRecommendationDirect("sk-test", "title-keyword", "kw", "ctx");
    // Drain the backoff setTimeout so the retry fires without waiting real seconds.
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe("Recovered Title");
    expect(createMock).toHaveBeenCalledTimes(2);
  });
});
