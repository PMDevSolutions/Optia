import type { PageSEOData, SEOCheck, CheckCategory } from "@/types/seo";
import { getLearnMoreUrl } from "@/lib/docs-links";

interface AnalyzerOptions {
  keyword: string;
  secondaryKeywords?: string;
  pageType?: string;
}

function containsKeywordWB(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

function containsAnyKeyword(text: string, primary: string, secondary: string[]): boolean {
  if (containsKeywordWB(text, primary)) return true;
  return secondary.some((kw) => kw.trim() && containsKeywordWB(text, kw.trim()));
}

export function runSEOChecks(
  data: PageSEOData,
  options: AnalyzerOptions,
): SEOCheck[] {
  const { keyword, pageType } = options;
  const secondaryKws = (options.secondaryKeywords ?? "")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const checks: SEOCheck[] = [];

  // --- META ---

  checks.push({
    id: "title-present",
    title: "Page has a title tag",
    description: "Every page should have a unique title tag.",
    status: data.title ? "pass" : "fail",
    priority: "high",
    category: "meta",
    details: data.title ? `Title: "${data.title}"` : "No title tag found.",
  });

  checks.push({
    id: "title-length",
    title: "Title length is optimal (50-60 characters)",
    description: "Title tags should be between 50-60 characters for optimal display in search results.",
    status:
      data.title.length >= 50 && data.title.length <= 60
        ? "pass"
        : data.title.length > 0
          ? "warning"
          : "fail",
    priority: "medium",
    category: "meta",
    details: `Title is ${data.title.length} characters.`,
  });

  checks.push({
    id: "title-keyword",
    title: "Title contains target keyword",
    description: `The title should contain your target keyword "${keyword}".`,
    status: containsAnyKeyword(data.title, keyword, secondaryKws) ? "pass" : "fail",
    priority: "high",
    category: "meta",
    details: containsAnyKeyword(data.title, keyword, secondaryKws)
      ? "Keyword found in title."
      : "Keyword not found in title.",
    copyable: true,
  });

  checks.push({
    id: "meta-description-present",
    title: "Page has a meta description",
    description: "A meta description helps search engines understand your page.",
    status: data.metaDescription ? "pass" : "fail",
    priority: "high",
    category: "meta",
    details: data.metaDescription
      ? `Description: "${data.metaDescription.slice(0, 80)}..."`
      : "No meta description found.",
  });

  checks.push({
    id: "meta-description-length",
    title: "Meta description length is optimal (120-155 characters)",
    description: "Meta descriptions should be between 120-155 characters.",
    status:
      data.metaDescription.length >= 120 && data.metaDescription.length <= 155
        ? "pass"
        : data.metaDescription.length > 0
          ? "warning"
          : "fail",
    priority: "medium",
    category: "meta",
    details: `Meta description is ${data.metaDescription.length} characters.`,
  });

  checks.push({
    id: "meta-description-keyword",
    title: "Meta description contains target keyword",
    description: `The meta description should contain your keyword "${keyword}".`,
    status: containsAnyKeyword(data.metaDescription, keyword, secondaryKws) ? "pass" : "fail",
    priority: "high",
    category: "meta",
    details: containsAnyKeyword(data.metaDescription, keyword, secondaryKws)
      ? "Keyword found in meta description."
      : "Keyword not found in meta description.",
    copyable: true,
  });

  checks.push({
    id: "keyword-url",
    title: "URL contains target keyword",
    description: `The URL slug should contain your keyword "${keyword}".`,
    status:
      pageType === "homepage"
        ? "pass"
        : containsAnyKeyword(data.url, keyword, secondaryKws) ? "pass" : "fail",
    priority: "medium",
    category: "meta",
    details:
      pageType === "homepage"
        ? "Homepage URLs don't need the keyword in the URL."
        : `URL: ${data.url}`,
    copyable: pageType !== "homepage",
  });

  // --- CONTENT ---

  checks.push({
    id: "h1-present",
    title: "Page has an H1 heading",
    description: "Every page should have exactly one H1 heading.",
    status: data.h1.length === 1 ? "pass" : "fail",
    priority: "high",
    category: "content",
    details:
      data.h1.length === 0
        ? "No H1 heading found."
        : data.h1.length > 1
          ? `Found ${data.h1.length} H1 headings. Should be exactly 1.`
          : `H1: "${data.h1[0]}"`,
  });

  checks.push({
    id: "h1-keyword",
    title: "H1 contains target keyword",
    description: `Your H1 should include your target keyword "${keyword}".`,
    status:
      data.h1.length > 0 && containsAnyKeyword(data.h1[0], keyword, secondaryKws)
        ? "pass"
        : "fail",
    priority: "high",
    category: "content",
    details:
      data.h1.length > 0 && containsAnyKeyword(data.h1[0], keyword, secondaryKws)
        ? "Keyword found in H1."
        : "Keyword not found in H1.",
    copyable: true,
  });

  // Heading hierarchy — proper sequential gap detection
  const headingLevels: number[] = [];
  for (let i = 1; i <= 6; i++) {
    const key = `h${i}` as keyof PageSEOData;
    const headings = data[key] as string[];
    for (const _h of headings) {
      headingLevels.push(i);
    }
  }
  // Rebuild in document order isn't possible from grouped data, so check for existence of levels
  let hierarchyOk = data.h1.length === 1;
  // Check that no heading level is used without a parent (e.g., H3 without H2)
  if (hierarchyOk) {
    const usedLevels = new Set<number>();
    if (data.h1.length > 0) usedLevels.add(1);
    if (data.h2.length > 0) usedLevels.add(2);
    if (data.h3.length > 0) usedLevels.add(3);
    if (data.h4.length > 0) usedLevels.add(4);
    if (data.h5.length > 0) usedLevels.add(5);
    if (data.h6.length > 0) usedLevels.add(6);
    for (const level of usedLevels) {
      if (level > 1 && !usedLevels.has(level - 1)) {
        hierarchyOk = false;
        break;
      }
    }
  }

  checks.push({
    id: "heading-hierarchy",
    title: "Heading hierarchy is correct",
    description: "Headings should follow a logical hierarchy (H1 → H2 → H3, etc.) without skipping levels.",
    status: hierarchyOk ? "pass" : data.h1.length === 1 ? "warning" : "fail",
    priority: "high",
    category: "content",
    details: `H1: ${data.h1.length}, H2: ${data.h2.length}, H3: ${data.h3.length}, H4: ${data.h4.length}`,
  });

  const minWords = pageType === "homepage" ? 300 : 600;
  checks.push({
    id: "word-count",
    title: `Page has sufficient content (${minWords}+ words)`,
    description: `Pages should have at least ${minWords} words for good rankings.`,
    status: data.wordCount >= minWords ? "pass" : "fail",
    priority: "high",
    category: "content",
    details: `Page has ${data.wordCount} words.`,
  });

  // Keyphrase density
  const bodyTextLower = data.paragraphs.join(" ").toLowerCase();
  const kwLower = keyword.toLowerCase();
  const kwRegex = new RegExp(`\\b${kwLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
  const kwMatches = bodyTextLower.match(kwRegex);
  const kwCount = kwMatches?.length ?? 0;
  const totalWords = data.wordCount || 1;
  const density = (kwCount / totalWords) * 100;
  const densityOk = density >= 0.5 && density <= 2.5;

  checks.push({
    id: "keyword-density",
    title: "Keyphrase density is optimal (0.5%-2.5%)",
    description: "Keyphrase should appear naturally, not too sparse or stuffed.",
    status: densityOk ? "pass" : kwCount > 0 ? "warning" : "fail",
    priority: "medium",
    category: "content",
    details: `Keyphrase density: ${density.toFixed(2)}% (${kwCount} occurrences in ${totalWords} words).`,
  });

  // Keyphrase in introduction
  const firstParagraph = data.paragraphs[0] ?? "";
  checks.push({
    id: "keyword-intro",
    title: "Keyphrase appears in introduction",
    description: "The target keyword should appear in the first paragraph of your content.",
    status: containsAnyKeyword(firstParagraph, keyword, secondaryKws) ? "pass" : "fail",
    priority: "medium",
    category: "content",
    details: firstParagraph
      ? containsAnyKeyword(firstParagraph, keyword, secondaryKws)
        ? "Keyword found in first paragraph."
        : "Keyword not found in first paragraph."
      : "No paragraphs found on page.",
    copyable: true,
  });

  // Keyphrase in H2 headings
  const h2WithKeyword = data.h2.filter((h) => containsAnyKeyword(h, keyword, secondaryKws));
  checks.push({
    id: "h2-keyword",
    title: "H2 headings contain target keyword",
    description: `At least one H2 heading should include your keyword "${keyword}".`,
    status:
      data.h2.length === 0
        ? "fail"
        : h2WithKeyword.length > 0
          ? "pass"
          : "fail",
    priority: "medium",
    category: "content",
    details:
      data.h2.length === 0
        ? "No H2 headings found."
        : `${h2WithKeyword.length}/${data.h2.length} H2 headings contain the keyword.`,
    h2Recommendations: data.h2.map((text, index) => ({
      index,
      text,
      suggestion: "",
    })),
    copyable: true,
  });

  // --- LINKS ---

  checks.push({
    id: "internal-links",
    title: "Page has internal links",
    description: "Internal links help search engines discover and understand your site structure.",
    status: data.internalLinks >= 3 ? "pass" : data.internalLinks > 0 ? "warning" : "fail",
    priority: "medium",
    category: "links",
    details: `${data.internalLinks} internal links found.`,
  });

  checks.push({
    id: "outbound-links",
    title: "Page has outbound links",
    description: "Outbound links to authoritative sources can improve your content's credibility.",
    status: data.externalLinks > 0 ? "pass" : "warning",
    priority: "low",
    category: "links",
    details: `${data.externalLinks} outbound links found.`,
  });

  // --- IMAGES ---

  const imagesMissingAlt = data.images.filter((img) => img.alt.trim() === "");
  const imagesWithAlt = data.images.filter((img) => img.alt.trim() !== "");

  checks.push({
    id: "images-alt",
    title: "All images have alt text",
    description: "Alt text improves accessibility and helps search engines understand images.",
    status:
      data.images.length === 0
        ? "pass"
        : imagesMissingAlt.length === 0
          ? "pass"
          : "fail",
    priority: "low",
    category: "images",
    details:
      data.images.length === 0
        ? "No images found on page."
        : `${imagesWithAlt.length}/${data.images.length} images have alt text.`,
    imageData: imagesMissingAlt,
    copyable: true,
  });

  // Next-gen image formats
  const nextGenExts = [".webp", ".avif", ".heic"];
  const totalImages = data.images.length;
  const nextGenCount = data.images.filter((img) => {
    const lower = img.src.toLowerCase().split("?")[0];
    return nextGenExts.some((ext) => lower.endsWith(ext));
  }).length;
  const nextGenPct = totalImages > 0 ? (nextGenCount / totalImages) * 100 : 100;

  checks.push({
    id: "next-gen-images",
    title: "Images use next-gen formats (WebP/AVIF)",
    description: "Modern image formats like WebP and AVIF provide better compression.",
    status: totalImages === 0 ? "pass" : nextGenPct >= 50 ? "pass" : "warning",
    priority: "low",
    category: "images",
    details:
      totalImages === 0
        ? "No images to check."
        : `${nextGenCount}/${totalImages} images (${nextGenPct.toFixed(0)}%) use next-gen formats.`,
  });

  // Image file size
  const oversizedImages = data.imageFileSizes.filter(
    (img) => img.sizeBytes !== null && img.sizeBytes > 500 * 1024,
  );
  checks.push({
    id: "image-file-size",
    title: "Images are under 500KB",
    description: "Large images slow down page load. Keep images under 500KB.",
    status:
      data.imageFileSizes.length === 0
        ? "warning"
        : oversizedImages.length === 0
          ? "pass"
          : "warning",
    priority: "medium",
    category: "images",
    details:
      data.imageFileSizes.length === 0
        ? "No image file size data available. Unable to verify in dev mode."
        : oversizedImages.length === 0
          ? "All images are under 500KB."
          : `${oversizedImages.length} image(s) exceed 500KB.`,
  });

  // OG image
  checks.push({
    id: "og-image",
    title: "Open Graph image is set",
    description: "An OG image controls how your page thumbnail appears when shared on social media.",
    status: data.ogImage ? "pass" : "fail",
    priority: "medium",
    category: "images",
    details: data.ogImage ? `OG Image: ${data.ogImage}` : "No og:image meta tag found.",
  });

  // --- TECHNICAL ---

  checks.push({
    id: "canonical",
    title: "Page has a canonical URL",
    description: "A canonical URL prevents duplicate content issues.",
    status: data.canonical ? "pass" : "fail",
    priority: "medium",
    category: "technical",
    details: data.canonical
      ? `Canonical: ${data.canonical}`
      : "No canonical tag found.",
  });

  checks.push({
    id: "og-tags",
    title: "Open Graph title and description are present",
    description: "OG tags control how your page appears when shared on social media.",
    status:
      data.ogTags["og:title"] && data.ogTags["og:description"]
        ? "pass"
        : "fail",
    priority: "medium",
    category: "technical",
    details: `Found ${Object.keys(data.ogTags).length} OG tags.`,
  });

  checks.push({
    id: "lang",
    title: "Page has a language attribute",
    description: "The HTML lang attribute helps search engines and screen readers.",
    status: data.lang ? "pass" : "warning",
    priority: "low",
    category: "technical",
    details: data.lang ? `Language: ${data.lang}` : "No lang attribute found.",
  });

  // Schema markup
  checks.push({
    id: "schema-markup",
    title: "Schema markup is present",
    description: "Structured data helps search engines understand your content and enables rich results.",
    status: data.schemaMarkup.count > 0 ? "pass" : "fail",
    priority: "medium",
    category: "technical",
    details:
      data.schemaMarkup.count > 0
        ? `Found ${data.schemaMarkup.count} schema(s): ${data.schemaMarkup.types.join(", ")}`
        : "No JSON-LD schema markup found.",
  });

  // Code minification
  const allResources = [...data.resources.js, ...data.resources.css];
  const minifiedCount = allResources.filter((url) => {
    const path = url.split("?")[0].toLowerCase();
    return (
      path.includes(".min.") ||
      /\.[a-f0-9]{6,}\./.test(path) ||
      path.includes("cdn") ||
      path.includes("/_next/") ||
      path.includes("/chunks/")
    );
  }).length;
  const minPct = allResources.length > 0 ? (minifiedCount / allResources.length) * 100 : 100;

  checks.push({
    id: "code-minification",
    title: "Code is minified",
    description: "Minified JS/CSS files load faster and improve page performance.",
    status: allResources.length === 0 ? "pass" : minPct >= 80 ? "pass" : "warning",
    priority: "low",
    category: "technical",
    details:
      allResources.length === 0
        ? "No external JS/CSS resources found."
        : `${minifiedCount}/${allResources.length} resources (${minPct.toFixed(0)}%) appear minified.`,
  });

  return checks.map((check) => ({
    ...check,
    learnMoreUrl: getLearnMoreUrl(check.id),
  }));
}

export function groupChecksByCategory(
  checks: SEOCheck[],
): Record<CheckCategory, SEOCheck[]> {
  const groups: Record<CheckCategory, SEOCheck[]> = {
    meta: [],
    content: [],
    links: [],
    images: [],
    technical: [],
  };
  for (const check of checks) {
    groups[check.category].push(check);
  }
  return groups;
}
