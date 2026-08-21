import type { PageSEOData, SEOCheck } from "@/types/seo";
import { runSEOChecks, groupChecksByCategory } from "./seo-analyzer";

function makePageData(overrides: Partial<PageSEOData> = {}): PageSEOData {
  return {
    url: "https://example.com/test-page",
    title: "Test Page Title for SEO Analysis Keywords",
    metaDescription:
      "This is a test meta description that contains important keywords for search engine optimization and helps users understand the page content better and more clearly.",
    metaKeywords: "",
    canonical: "https://example.com/test-page",
    h1: ["Test H1 Heading with Keywords"],
    h2: ["Second Heading with Keywords"],
    h3: [],
    h4: [],
    h5: [],
    h6: [],
    images: [],
    ogTags: { "og:title": "Test", "og:description": "Test desc" },
    twitterTags: {},
    wordCount: 800,
    internalLinks: 5,
    externalLinks: 2,
    lang: "en",
    paragraphs: [
      "This is the first paragraph with keywords for testing the SEO analyzer tool.",
    ],
    resources: { js: [], css: [] },
    schemaMarkup: { types: ["Article"], count: 1 },
    ogImage: "https://example.com/og.jpg",
    imageFileSizes: [],
    ...overrides,
  };
}

function findCheck(checks: SEOCheck[], id: string): SEOCheck {
  const check = checks.find((c) => c.id === id);
  if (!check) throw new Error(`Check with id "${id}" not found`);
  return check;
}

const defaultOptions = { keyword: "keywords" };

describe("runSEOChecks", () => {
  describe("Meta checks", () => {
    it("title-present: passes when title exists", () => {
      const checks = runSEOChecks(makePageData(), defaultOptions);
      expect(findCheck(checks, "title-present").status).toBe("pass");
    });

    it("title-present: fails when title is empty", () => {
      const checks = runSEOChecks(makePageData({ title: "" }), defaultOptions);
      expect(findCheck(checks, "title-present").status).toBe("fail");
    });

    it("title-length: passes for 50-60 characters", () => {
      const title = "A".repeat(55);
      const checks = runSEOChecks(makePageData({ title }), defaultOptions);
      expect(findCheck(checks, "title-length").status).toBe("pass");
    });

    it("title-length: warns for non-empty title outside 50-60 range", () => {
      const checks = runSEOChecks(
        makePageData({ title: "Short" }),
        defaultOptions,
      );
      expect(findCheck(checks, "title-length").status).toBe("warning");
    });

    it("title-length: fails for empty title", () => {
      const checks = runSEOChecks(makePageData({ title: "" }), defaultOptions);
      expect(findCheck(checks, "title-length").status).toBe("fail");
    });

    it("title-keyword: passes when keyword is in title (word boundary)", () => {
      const checks = runSEOChecks(
        makePageData({ title: "Best keywords guide" }),
        { keyword: "keywords" },
      );
      expect(findCheck(checks, "title-keyword").status).toBe("pass");
    });

    it("title-keyword: fails when keyword is not in title", () => {
      const checks = runSEOChecks(
        makePageData({ title: "Unrelated title here" }),
        { keyword: "keywords" },
      );
      expect(findCheck(checks, "title-keyword").status).toBe("fail");
    });

    it("title-keyword: passes when a secondary keyword matches", () => {
      const checks = runSEOChecks(
        makePageData({ title: "Boost your ranking today" }),
        { keyword: "seo", secondaryKeywords: "ranking, traffic" },
      );
      expect(findCheck(checks, "title-keyword").status).toBe("pass");
    });

    it("meta-description-present: passes when description exists", () => {
      const checks = runSEOChecks(makePageData(), defaultOptions);
      expect(findCheck(checks, "meta-description-present").status).toBe(
        "pass",
      );
    });

    it("meta-description-present: fails when description is empty", () => {
      const checks = runSEOChecks(
        makePageData({ metaDescription: "" }),
        defaultOptions,
      );
      expect(findCheck(checks, "meta-description-present").status).toBe(
        "fail",
      );
    });

    it("meta-description-length: passes for 120-155 characters", () => {
      const desc = "A".repeat(130);
      const checks = runSEOChecks(
        makePageData({ metaDescription: desc }),
        defaultOptions,
      );
      expect(findCheck(checks, "meta-description-length").status).toBe("pass");
    });

    it("meta-description-length: warns for non-empty description outside 120-155 range", () => {
      const checks = runSEOChecks(
        makePageData({ metaDescription: "Too short" }),
        defaultOptions,
      );
      expect(findCheck(checks, "meta-description-length").status).toBe(
        "warning",
      );
    });

    it("meta-description-length: fails for empty description", () => {
      const checks = runSEOChecks(
        makePageData({ metaDescription: "" }),
        defaultOptions,
      );
      expect(findCheck(checks, "meta-description-length").status).toBe("fail");
    });

    it("meta-description-keyword: passes when keyword present", () => {
      const checks = runSEOChecks(
        makePageData({
          metaDescription: "Learn about keywords in SEO optimization.",
        }),
        { keyword: "keywords" },
      );
      expect(findCheck(checks, "meta-description-keyword").status).toBe(
        "pass",
      );
    });

    it("meta-description-keyword: fails when keyword absent", () => {
      const checks = runSEOChecks(
        makePageData({ metaDescription: "Nothing relevant here at all." }),
        { keyword: "keywords" },
      );
      expect(findCheck(checks, "meta-description-keyword").status).toBe(
        "fail",
      );
    });

    it("keyword-url: passes when keyword is in URL", () => {
      const checks = runSEOChecks(
        makePageData({ url: "https://example.com/best-keywords-guide" }),
        { keyword: "keywords" },
      );
      const check = findCheck(checks, "keyword-url");
      expect(check.status).toBe("pass");
      expect(check.copyable).toBe(true);
    });

    it("keyword-url: auto-passes for homepage pageType", () => {
      const checks = runSEOChecks(
        makePageData({ url: "https://example.com/" }),
        { keyword: "keywords", pageType: "homepage" },
      );
      const check = findCheck(checks, "keyword-url");
      expect(check.status).toBe("pass");
      expect(check.copyable).toBe(false);
    });
  });

  describe("Content checks", () => {
    it("h1-present: passes for exactly one H1", () => {
      const checks = runSEOChecks(
        makePageData({ h1: ["Single H1"] }),
        defaultOptions,
      );
      expect(findCheck(checks, "h1-present").status).toBe("pass");
    });

    it("h1-present: fails for zero H1s", () => {
      const checks = runSEOChecks(makePageData({ h1: [] }), defaultOptions);
      expect(findCheck(checks, "h1-present").status).toBe("fail");
    });

    it("h1-present: fails for multiple H1s", () => {
      const checks = runSEOChecks(
        makePageData({ h1: ["First H1", "Second H1"] }),
        defaultOptions,
      );
      expect(findCheck(checks, "h1-present").status).toBe("fail");
    });

    it("h1-keyword: passes when keyword is in H1", () => {
      const checks = runSEOChecks(
        makePageData({ h1: ["Heading about keywords"] }),
        { keyword: "keywords" },
      );
      expect(findCheck(checks, "h1-keyword").status).toBe("pass");
    });

    it("h1-keyword: fails when keyword is not in H1", () => {
      const checks = runSEOChecks(
        makePageData({ h1: ["Unrelated heading"] }),
        { keyword: "keywords" },
      );
      expect(findCheck(checks, "h1-keyword").status).toBe("fail");
    });

    it("heading-hierarchy: passes for clean H1 -> H2 -> H3", () => {
      const checks = runSEOChecks(
        makePageData({
          h1: ["Main"],
          h2: ["Sub"],
          h3: ["Detail"],
        }),
        defaultOptions,
      );
      expect(findCheck(checks, "heading-hierarchy").status).toBe("pass");
    });

    it("heading-hierarchy: warns when levels are skipped (H3 without H2)", () => {
      const checks = runSEOChecks(
        makePageData({
          h1: ["Main"],
          h2: [],
          h3: ["Skipped to H3"],
        }),
        defaultOptions,
      );
      expect(findCheck(checks, "heading-hierarchy").status).toBe("warning");
    });

    it("heading-hierarchy: fails when no H1 present", () => {
      const checks = runSEOChecks(
        makePageData({ h1: [], h2: ["Sub"] }),
        defaultOptions,
      );
      expect(findCheck(checks, "heading-hierarchy").status).toBe("fail");
    });

    it("word-count: passes for 600+ words (blog-post default)", () => {
      const checks = runSEOChecks(
        makePageData({ wordCount: 800 }),
        defaultOptions,
      );
      expect(findCheck(checks, "word-count").status).toBe("pass");
    });

    it("word-count: uses 300 threshold for homepage", () => {
      const checks = runSEOChecks(makePageData({ wordCount: 350 }), {
        keyword: "keywords",
        pageType: "homepage",
      });
      expect(findCheck(checks, "word-count").status).toBe("pass");

      const checks2 = runSEOChecks(makePageData({ wordCount: 350 }), {
        keyword: "keywords",
        pageType: "blog-post",
      });
      expect(findCheck(checks2, "word-count").status).toBe("fail");
    });

    it("keyword-density: passes for density within 0.5%-2.5%", () => {
      // 10 occurrences of "seo" in 800 words = 1.25%
      const paragraph =
        "seo ".repeat(10) + "other ".repeat(90);
      const checks = runSEOChecks(
        makePageData({ paragraphs: [paragraph], wordCount: 800 }),
        { keyword: "seo" },
      );
      expect(findCheck(checks, "keyword-density").status).toBe("pass");
    });

    it("keyword-density: warns when keyword present but outside range", () => {
      // 1 occurrence in 800 words = 0.125% (below 0.5%)
      const checks = runSEOChecks(
        makePageData({
          paragraphs: ["One mention of seo in a long text."],
          wordCount: 800,
        }),
        { keyword: "seo" },
      );
      expect(findCheck(checks, "keyword-density").status).toBe("warning");
    });

    it("keyword-density: fails when keyword count is zero", () => {
      const checks = runSEOChecks(
        makePageData({
          paragraphs: ["No relevant term here at all."],
          wordCount: 800,
        }),
        { keyword: "keywords" },
      );
      expect(findCheck(checks, "keyword-density").status).toBe("fail");
    });

    it("keyword-intro: passes when keyword in first paragraph", () => {
      const checks = runSEOChecks(
        makePageData({
          paragraphs: ["This paragraph mentions keywords early."],
        }),
        { keyword: "keywords" },
      );
      expect(findCheck(checks, "keyword-intro").status).toBe("pass");
    });

    it("h2-keyword: passes when at least one H2 has keyword", () => {
      const checks = runSEOChecks(
        makePageData({ h2: ["Guide to keywords", "Unrelated heading"] }),
        { keyword: "keywords" },
      );
      const check = findCheck(checks, "h2-keyword");
      expect(check.status).toBe("pass");
      expect(check.h2Recommendations).toHaveLength(2);
    });

    it("h2-keyword: fails when no H2 has keyword", () => {
      const checks = runSEOChecks(
        makePageData({ h2: ["Unrelated heading"] }),
        { keyword: "keywords" },
      );
      expect(findCheck(checks, "h2-keyword").status).toBe("fail");
    });

    it("h2-keyword: fails when no H2s exist", () => {
      const checks = runSEOChecks(makePageData({ h2: [] }), {
        keyword: "keywords",
      });
      expect(findCheck(checks, "h2-keyword").status).toBe("fail");
    });
  });

  describe("Links checks", () => {
    it("internal-links: passes for 3+", () => {
      const checks = runSEOChecks(
        makePageData({ internalLinks: 5 }),
        defaultOptions,
      );
      expect(findCheck(checks, "internal-links").status).toBe("pass");
    });

    it("internal-links: warns for 1-2", () => {
      const checks = runSEOChecks(
        makePageData({ internalLinks: 2 }),
        defaultOptions,
      );
      expect(findCheck(checks, "internal-links").status).toBe("warning");
    });

    it("internal-links: fails for 0", () => {
      const checks = runSEOChecks(
        makePageData({ internalLinks: 0 }),
        defaultOptions,
      );
      expect(findCheck(checks, "internal-links").status).toBe("fail");
    });

    it("outbound-links: passes for 1+", () => {
      const checks = runSEOChecks(
        makePageData({ externalLinks: 1 }),
        defaultOptions,
      );
      expect(findCheck(checks, "outbound-links").status).toBe("pass");
    });

    it("outbound-links: warns for 0", () => {
      const checks = runSEOChecks(
        makePageData({ externalLinks: 0 }),
        defaultOptions,
      );
      expect(findCheck(checks, "outbound-links").status).toBe("warning");
    });
  });

  describe("Images checks", () => {
    it("images-alt: passes when no images exist", () => {
      const checks = runSEOChecks(
        makePageData({ images: [] }),
        defaultOptions,
      );
      expect(findCheck(checks, "images-alt").status).toBe("pass");
    });

    it("images-alt: passes when all images have alt text", () => {
      const checks = runSEOChecks(
        makePageData({
          images: [
            { src: "a.jpg", alt: "Photo A", width: 100, height: 100 },
          ],
        }),
        defaultOptions,
      );
      expect(findCheck(checks, "images-alt").status).toBe("pass");
    });

    it("images-alt: fails when some images lack alt text and populates imageData", () => {
      const images = [
        { src: "a.jpg", alt: "", width: 100, height: 100 },
        { src: "b.jpg", alt: "Has alt", width: 100, height: 100 },
      ];
      const checks = runSEOChecks(makePageData({ images }), defaultOptions);
      const check = findCheck(checks, "images-alt");
      expect(check.status).toBe("fail");
      expect(check.imageData).toHaveLength(1);
      expect(check.imageData![0].src).toBe("a.jpg");
    });

    it("next-gen-images: passes when 50%+ are webp/avif", () => {
      const images = [
        { src: "a.webp", alt: "A", width: 100, height: 100 },
        { src: "b.jpg", alt: "B", width: 100, height: 100 },
      ];
      const checks = runSEOChecks(makePageData({ images }), defaultOptions);
      expect(findCheck(checks, "next-gen-images").status).toBe("pass");
    });

    it("next-gen-images: warns when below 50%", () => {
      const images = [
        { src: "a.jpg", alt: "A", width: 100, height: 100 },
        { src: "b.png", alt: "B", width: 100, height: 100 },
        { src: "c.webp", alt: "C", width: 100, height: 100 },
      ];
      const checks = runSEOChecks(makePageData({ images }), defaultOptions);
      expect(findCheck(checks, "next-gen-images").status).toBe("warning");
    });

    it("next-gen-images: passes when no images", () => {
      const checks = runSEOChecks(
        makePageData({ images: [] }),
        defaultOptions,
      );
      expect(findCheck(checks, "next-gen-images").status).toBe("pass");
    });

    it("image-file-size: warns when no file size data is available", () => {
      const checks = runSEOChecks(
        makePageData({ imageFileSizes: [] }),
        defaultOptions,
      );
      const check = findCheck(checks, "image-file-size");
      expect(check.status).toBe("warning");
      expect(check.details).toContain("Unable to verify");
    });

    it("image-file-size: passes when all under 500KB", () => {
      const checks = runSEOChecks(
        makePageData({
          imageFileSizes: [{ src: "a.jpg", sizeBytes: 100_000 }],
        }),
        defaultOptions,
      );
      expect(findCheck(checks, "image-file-size").status).toBe("pass");
    });

    it("image-file-size: warns when an image exceeds 500KB", () => {
      const checks = runSEOChecks(
        makePageData({
          imageFileSizes: [{ src: "big.jpg", sizeBytes: 600_000 }],
        }),
        defaultOptions,
      );
      expect(findCheck(checks, "image-file-size").status).toBe("warning");
    });

    it("og-image: passes when og image set", () => {
      const checks = runSEOChecks(
        makePageData({ ogImage: "https://example.com/og.jpg" }),
        defaultOptions,
      );
      expect(findCheck(checks, "og-image").status).toBe("pass");
    });

    it("og-image: fails when og image empty", () => {
      const checks = runSEOChecks(
        makePageData({ ogImage: "" }),
        defaultOptions,
      );
      expect(findCheck(checks, "og-image").status).toBe("fail");
    });
  });

  describe("Technical checks", () => {
    it("canonical: passes when canonical is set", () => {
      const checks = runSEOChecks(makePageData(), defaultOptions);
      expect(findCheck(checks, "canonical").status).toBe("pass");
    });

    it("canonical: fails when canonical is empty", () => {
      const checks = runSEOChecks(
        makePageData({ canonical: "" }),
        defaultOptions,
      );
      expect(findCheck(checks, "canonical").status).toBe("fail");
    });

    it("og-tags: passes when og:title and og:description present", () => {
      const checks = runSEOChecks(
        makePageData({
          ogTags: { "og:title": "T", "og:description": "D" },
        }),
        defaultOptions,
      );
      expect(findCheck(checks, "og-tags").status).toBe("pass");
    });

    it("og-tags: fails when og:title or og:description missing", () => {
      const checks = runSEOChecks(
        makePageData({ ogTags: { "og:title": "T" } }),
        defaultOptions,
      );
      expect(findCheck(checks, "og-tags").status).toBe("fail");
    });

    it("lang: passes when lang attribute set", () => {
      const checks = runSEOChecks(
        makePageData({ lang: "en" }),
        defaultOptions,
      );
      expect(findCheck(checks, "lang").status).toBe("pass");
    });

    it("lang: warns when lang attribute empty", () => {
      const checks = runSEOChecks(
        makePageData({ lang: "" }),
        defaultOptions,
      );
      expect(findCheck(checks, "lang").status).toBe("warning");
    });

    it("schema-markup: passes when count > 0", () => {
      const checks = runSEOChecks(
        makePageData({ schemaMarkup: { types: ["Article"], count: 1 } }),
        defaultOptions,
      );
      expect(findCheck(checks, "schema-markup").status).toBe("pass");
    });

    it("schema-markup: fails when count is 0", () => {
      const checks = runSEOChecks(
        makePageData({ schemaMarkup: { types: [], count: 0 } }),
        defaultOptions,
      );
      expect(findCheck(checks, "schema-markup").status).toBe("fail");
    });

    it("code-minification: passes when 80%+ resources look minified", () => {
      const checks = runSEOChecks(
        makePageData({
          resources: {
            js: ["app.min.js", "vendor.abc123.js", "cdn/lib.js", "raw.js"],
            css: ["style.min.css"],
          },
        }),
        defaultOptions,
      );
      expect(findCheck(checks, "code-minification").status).toBe("pass");
    });

    it("code-minification: warns when below 80% minified", () => {
      const checks = runSEOChecks(
        makePageData({
          resources: {
            js: ["app.js", "vendor.js", "utils.js"],
            css: ["style.css", "theme.min.css"],
          },
        }),
        defaultOptions,
      );
      expect(findCheck(checks, "code-minification").status).toBe("warning");
    });
  });

  describe("containsKeywordWB behavior (implicit)", () => {
    it("does not match partial words (keyword 'test' should not match 'testing')", () => {
      const checks = runSEOChecks(
        makePageData({ title: "Testing your website today" }),
        { keyword: "test" },
      );
      expect(findCheck(checks, "title-keyword").status).toBe("fail");
    });

    it("escapes special regex characters in keyword without throwing", () => {
      // Keywords with special regex chars like C++ should not cause a regex error.
      // Note: \b word boundary requires a word char adjacent to a non-word char,
      // so "C++" won't match via \b because "+" is non-word. This tests no crash.
      expect(() =>
        runSEOChecks(
          makePageData({ title: "Guide to C++ programming" }),
          { keyword: "C++" },
        ),
      ).not.toThrow();
    });

    it("escapes special regex characters and matches when boundaries align", () => {
      // Parentheses are special regex chars; "node.js" has a word boundary after "js"
      const checks = runSEOChecks(
        makePageData({ title: "Learn about node.js development today" }),
        { keyword: "node.js" },
      );
      expect(findCheck(checks, "title-keyword").status).toBe("pass");
    });
  });

  describe("learnMoreUrl", () => {
    const DOCS_BASE = "https://pmdevsolutions.github.io/Optia/docs/";

    it("every check links to a specific page on Optia's own docs site", () => {
      const checks = runSEOChecks(makePageData(), defaultOptions);
      for (const check of checks) {
        expect(check.learnMoreUrl, check.id).toContain(DOCS_BASE);
        // Every shipped check must have an explicit mapping, never the fallback.
        expect(check.learnMoreUrl, check.id).not.toContain("/docs/index.html");
      }
    });

    it("every linked docs page exists in site/docs (generated by scripts/build-docs-site.mjs)", async () => {
      const { existsSync } = await import("node:fs");
      const { resolve } = await import("node:path");
      const checks = runSEOChecks(makePageData(), defaultOptions);
      for (const check of checks) {
        const relPath = (check.learnMoreUrl ?? "").replace(DOCS_BASE, "");
        const file = resolve(__dirname, "../../../site/docs", relPath);
        expect(existsSync(file), `${check.id} → ${check.learnMoreUrl}`).toBe(true);
      }
    });
  });
});

describe("groupChecksByCategory", () => {
  it("groups checks into the correct categories", () => {
    const checks = runSEOChecks(makePageData(), defaultOptions);
    const groups = groupChecksByCategory(checks);

    expect(Object.keys(groups)).toEqual(
      expect.arrayContaining(["meta", "content", "links", "images", "technical"]),
    );

    for (const category of Object.keys(groups) as Array<keyof typeof groups>) {
      for (const check of groups[category]) {
        expect(check.category).toBe(category);
      }
    }

    const totalGrouped = Object.values(groups).reduce(
      (sum, arr) => sum + arr.length,
      0,
    );
    expect(totalGrouped).toBe(checks.length);
  });
});
