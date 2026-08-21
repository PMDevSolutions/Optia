#!/usr/bin/env node
// Generates the static SEO docs under site/docs/ — the targets of the
// extension's per-check "Learn More" links (app/src/lib/docs-links.ts).
//
// The generated HTML is committed; GitHub Pages publishes site/ verbatim
// (.github/workflows/pages.yml). To change a page, edit the PAGES data or
// template below and re-run:  node scripts/build-docs-site.mjs
//
// Slugs are load-bearing: docs-links.ts maps every check id to
// docs/<category>/<slug>.html. Renaming a slug requires updating that map.

import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SITE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../site");
const DOCS_DIR = join(SITE_DIR, "docs");

const CATEGORIES = {
  "meta-seo": "Meta SEO",
  content: "Content",
  links: "Links",
  images: "Images",
  technical: "Technical SEO",
};

/** @type {Array<{category: keyof typeof CATEGORIES, slug: string, title: string, checks: string[], what: string, why: string, fixes: string[], ai?: string}>} */
const PAGES = [
  // --- Meta SEO --------------------------------------------------------------
  {
    category: "meta-seo",
    slug: "page-title",
    title: "Page titles and your target keyword",
    checks: [
      "Page has a title tag",
      "Title length is optimal (50-60 characters)",
      "Title contains target keyword",
    ],
    what: "Optia verifies the page has a <code>&lt;title&gt;</code> tag, that it is 50–60 characters long, and that it contains your target keyword.",
    why: "The title tag is the headline of your search result and one of the strongest on-page relevance signals. Titles beyond ~60 characters get truncated in results, and a missing keyword makes it harder for both users and search engines to connect the page to the query.",
    fixes: [
      "Give every page exactly one <code>&lt;title&gt;</code> tag inside <code>&lt;head&gt;</code>.",
      "Keep it between 50 and 60 characters so it displays in full on the results page.",
      "Place the target keyword near the front, phrased naturally — no keyword stuffing.",
      "Make each title unique across your site; duplicate titles dilute relevance.",
    ],
    ai: "Optia can generate an optimized title for you: open the check and use the AI recommendation — it returns ready-to-paste title text incorporating your keyword.",
  },
  {
    category: "meta-seo",
    slug: "meta-description",
    title: "Meta descriptions that earn the click",
    checks: [
      "Page has a meta description",
      "Meta description length is optimal (120-155 characters)",
      "Meta description contains target keyword",
    ],
    what: "Optia verifies the page has a <code>&lt;meta name=\"description\"&gt;</code>, that it is 120–155 characters, and that it includes your target keyword.",
    why: "The meta description is your search-result ad copy. It rarely affects ranking directly, but it strongly affects click-through rate — and search engines bold the searcher's query terms inside it, so including your keyword makes the snippet visually pop.",
    fixes: [
      "Add one <code>&lt;meta name=\"description\" content=\"…\"&gt;</code> per page.",
      "Aim for 120–155 characters: long enough to sell the page, short enough not to be cut off.",
      "Work the target keyword in naturally, ideally in the first sentence.",
      "End with a reason to click — a benefit or a call to action.",
    ],
    ai: "Optia's AI recommendation writes a compelling, correctly sized meta description around your keyword in one click.",
  },
  {
    category: "meta-seo",
    slug: "keyword-in-url",
    title: "Keywords in the URL",
    checks: ["URL contains target keyword"],
    what: "Optia checks whether the page's URL (typically the final slug) contains your target keyword.",
    why: "A descriptive, keyword-bearing URL is a small ranking signal and a large trust signal: people are more likely to click a URL that visibly matches what they searched for, and shared links carry their own context.",
    fixes: [
      "Use short, lowercase, hyphen-separated slugs: <code>/trail-running-shoes</code>, not <code>/p?id=4821</code>.",
      "Include the main keyword once; skip filler words (a, the, and).",
      "When renaming an existing URL, add a 301 redirect from the old address so you keep its accumulated equity.",
    ],
    ai: "Optia can suggest an SEO-friendly slug for the page from your keyword.",
  },
  {
    category: "meta-seo",
    slug: "open-graph",
    title: "Open Graph tags and social sharing",
    checks: ["Open Graph title and description are present", "Open Graph image is set"],
    what: "Optia checks for <code>og:title</code> and <code>og:description</code> meta tags, and for an <code>og:image</code> so shares render with a preview image.",
    why: "When your page is shared on social platforms or in chat apps, Open Graph tags control the card people see. Links with a real title, description, and image get dramatically more engagement than bare-URL previews — and these tags are also what many search and AI surfaces use for rich previews.",
    fixes: [
      "Add <code>og:title</code>, <code>og:description</code>, <code>og:image</code>, and <code>og:url</code> to <code>&lt;head&gt;</code>.",
      "Use an image of at least 1200×630 pixels so it renders sharp on large cards.",
      "Serve the image from an absolute URL that is publicly reachable (no auth, no localhost).",
      "Mirror the tags with Twitter Card tags (<code>twitter:card</code>, <code>twitter:title</code>, …) for full coverage.",
    ],
  },

  // --- Content ---------------------------------------------------------------
  {
    category: "content",
    slug: "h1-heading",
    title: "The H1 heading",
    checks: ["Page has an H1 heading", "H1 contains target keyword"],
    what: "Optia verifies the page has an <code>&lt;h1&gt;</code> and that it contains your target keyword.",
    why: "The H1 is the on-page headline — the strongest content-side statement of what the page is about. Search engines weight it heavily when deciding relevance, and readers use it to confirm they landed in the right place.",
    fixes: [
      "Use exactly one <code>&lt;h1&gt;</code> per page, near the top of the content.",
      "Include the target keyword naturally; the H1 can differ from the title tag but should agree with it.",
      "Keep it a real headline for humans — descriptive and specific beats clever and vague.",
    ],
    ai: "Optia's AI recommendation drafts an H1 that contains your exact keyword and still reads like a headline.",
  },
  {
    category: "content",
    slug: "heading-hierarchy",
    title: "Heading hierarchy",
    checks: ["Heading hierarchy is correct"],
    what: "Optia checks that headings step down without skipping levels — H1 to H2 to H3 — with no jumps like H1 straight to H4.",
    why: "Headings are the outline of your page. A clean hierarchy helps search engines understand structure and pick passages for featured snippets, and it is essential for screen-reader users, who navigate by heading level.",
    fixes: [
      "Start from a single H1 and nest sections with H2, subsections with H3, and so on.",
      "Never choose a heading level for its font size — style headings with CSS instead.",
      "Do not skip levels going down (H2 → H4); coming back up any number of levels is fine.",
    ],
  },
  {
    category: "content",
    slug: "h2-headings",
    title: "Keywords in H2 headings",
    checks: ["H2 headings contain target keyword"],
    what: "Optia checks whether at least one <code>&lt;h2&gt;</code> on the page contains your target keyword.",
    why: "H2s label the major sections of your content. Echoing the target keyword in at least one of them reinforces topical relevance, helps search engines match section passages to queries, and reassures skimming readers that the page covers what they came for.",
    fixes: [
      "Work the exact keyword (not just a synonym) into one or two H2s where it fits naturally.",
      "Keep headings honest — an H2 must still describe its section.",
      "Don't force it into every heading; one or two placements is enough.",
    ],
    ai: "Use Optia's per-heading suggestions (or Generate All) to get rewritten, copy-ready H2s that include your keyword.",
  },
  {
    category: "content",
    slug: "keyword-density",
    title: "Keyphrase density",
    checks: ["Keyphrase density is optimal (0.5%-2.5%)"],
    what: "Optia measures how often your target keyword appears relative to total word count, flagging densities outside 0.5%–2.5%.",
    why: "Too few mentions and the page may never be seen as being about the topic; too many reads as keyword stuffing, which hurts both rankings and readability. The healthy band is wide — this check catches the extremes, not fine tuning.",
    fixes: [
      "Under 0.5%: add the keyword to a few natural spots — the introduction, one heading, image alt text.",
      "Over 2.5%: replace repeats with pronouns, synonyms, or related phrases.",
      "Write for the reader first; density should be a side effect of covering the topic well.",
    ],
  },
  {
    category: "content",
    slug: "introduction",
    title: "Keywords in the introduction",
    checks: ["Keyphrase appears in introduction"],
    what: "Optia checks whether your target keyword appears in the page's opening paragraph.",
    why: "The first paragraph is where both readers and search engines decide what the page is about. An early keyword mention confirms relevance immediately and often becomes part of the snippet shown in results.",
    fixes: [
      "Mention the target keyword within the first two or three sentences.",
      "State plainly what the page delivers — the introduction should answer \"am I in the right place?\"",
      "Avoid burying the opening under hero images or boilerplate that pushes real content down.",
    ],
    ai: "Optia can rewrite your introduction to include the keyword while keeping your message and tone.",
  },
  {
    category: "content",
    slug: "content-length",
    title: "Content length",
    checks: ["Page has sufficient content"],
    what: "Optia counts the words in the page's main content and flags pages that fall below the threshold for their page type.",
    why: "Thin pages struggle to demonstrate expertise or answer a query fully, and are more likely to be treated as low-value. Substantial content earns more internal-link opportunities, more long-tail matches, and more time on page.",
    fixes: [
      "Cover the topic completely: answer the obvious follow-up questions on the same page.",
      "Add substance, not padding — examples, data, steps, and FAQs beat restating the same point.",
      "If a page can't sustain enough depth on its own, merge it into a stronger related page and redirect.",
    ],
  },

  // --- Links -----------------------------------------------------------------
  {
    category: "links",
    slug: "internal-links",
    title: "Internal links",
    checks: ["Page has internal links"],
    what: "Optia checks that the page links to other pages on the same site.",
    why: "Internal links are how authority and discovery flow through your site: they help crawlers find pages, tell search engines which pages matter most, and keep visitors moving instead of bouncing.",
    fixes: [
      "Link to related pages from within the body copy, not just menus and footers.",
      "Use descriptive anchor text (\"trail running shoe guide\") instead of \"click here\".",
      "Make sure important pages are reachable within a few clicks of the home page.",
    ],
  },
  {
    category: "links",
    slug: "outbound-links",
    title: "Outbound links",
    checks: ["Page has outbound links"],
    what: "Optia checks that the page links out to at least one external site.",
    why: "Citing sources and pointing to authoritative external references is a mark of trustworthy content. It gives readers a path to verify claims and situates your page inside the wider topic graph search engines model.",
    fixes: [
      "Link to primary sources for statistics, quotes, and claims.",
      "Prefer reputable, relevant destinations; a couple of good links beats a dozen weak ones.",
      "Add <code>rel=\"nofollow\"</code> or <code>rel=\"sponsored\"</code> only where the relationship requires it (paid or untrusted links).",
    ],
  },

  // --- Images ----------------------------------------------------------------
  {
    category: "images",
    slug: "alt-text",
    title: "Image alt text",
    checks: ["All images have alt text"],
    what: "Optia checks that every meaningful <code>&lt;img&gt;</code> on the page has a descriptive <code>alt</code> attribute.",
    why: "Alt text is how screen-reader users perceive images and how search engines index them — it powers image search and adds topical context to the page. Missing alt text is simultaneously an accessibility failure and a lost ranking opportunity.",
    fixes: [
      "Describe what the image shows in a specific phrase under ~125 characters.",
      "Include the target keyword only where it genuinely describes the image.",
      "Use <code>alt=\"\"</code> (empty, not missing) for purely decorative images so assistive tech skips them.",
    ],
    ai: "Optia generates descriptive, keyword-aware alt text per image — review each suggestion against the actual image before applying.",
  },
  {
    category: "images",
    slug: "next-gen-formats",
    title: "Next-gen image formats",
    checks: ["Images use next-gen formats (WebP/AVIF)"],
    what: "Optia checks whether the page's images are served as WebP or AVIF rather than legacy JPEG/PNG.",
    why: "WebP and AVIF compress 25–50% smaller than JPEG at the same visual quality. Smaller images mean faster Largest Contentful Paint, and page speed is both a ranking factor and a conversion factor.",
    fixes: [
      "Convert photos to WebP or AVIF in your build pipeline, CDN, or image CMS.",
      "Use <code>&lt;picture&gt;</code> with a legacy fallback if you must support very old browsers.",
      "Keep SVG for icons and line art — it's already the right tool there.",
    ],
  },
  {
    category: "images",
    slug: "image-file-size",
    title: "Image file size",
    checks: ["Images are under 500KB"],
    what: "Optia flags images heavier than 500KB.",
    why: "Oversized images are the most common cause of slow pages. Every oversized hero image delays Largest Contentful Paint, burns mobile data, and drags down the speed signals search engines measure in the field.",
    fixes: [
      "Resize images to the largest size they actually display at — don't ship 4000px originals into a 800px slot.",
      "Compress on export (quality 70–85 is usually visually lossless) or automate it with your CDN.",
      "Lazy-load below-the-fold images with <code>loading=\"lazy\"</code> so they don't compete with critical content.",
    ],
  },

  // --- Technical -------------------------------------------------------------
  {
    category: "technical",
    slug: "canonical-url",
    title: "Canonical URLs",
    checks: ["Page has a canonical URL"],
    what: "Optia checks for a <code>&lt;link rel=\"canonical\"&gt;</code> tag declaring the page's preferred URL.",
    why: "The same content is often reachable at several URLs (with/without trailing slash, tracking parameters, http vs https). A canonical tag consolidates those variants into one indexed URL so ranking signals aren't split across duplicates.",
    fixes: [
      "Add <code>&lt;link rel=\"canonical\" href=\"https://example.com/page\"&gt;</code> to every indexable page — self-referencing is correct for unique pages.",
      "Use the absolute, preferred-protocol URL and keep it consistent with your sitemap.",
      "Point variant pages (filtered, paginated, UTM-tagged) at their primary version.",
    ],
  },
  {
    category: "technical",
    slug: "language-attribute",
    title: "The lang attribute",
    checks: ["Page has a language attribute"],
    what: "Optia checks that the <code>&lt;html&gt;</code> element declares its language, e.g. <code>&lt;html lang=\"en\"&gt;</code>.",
    why: "The lang attribute tells screen readers which pronunciation rules to use and helps search engines serve the page to the right language audience. Without it, assistive tech guesses — often badly.",
    fixes: [
      "Set <code>lang</code> on the root <code>&lt;html&gt;</code> element using a valid BCP 47 code (<code>en</code>, <code>en-GB</code>, <code>de</code>, …).",
      "Match the code to the page's actual primary language.",
      "For multilingual sites, pair it with <code>hreflang</code> links between language versions.",
    ],
  },
  {
    category: "technical",
    slug: "schema-markup",
    title: "Schema markup (structured data)",
    checks: ["Schema markup is present"],
    what: "Optia checks for JSON-LD structured data (<code>&lt;script type=\"application/ld+json\"&gt;</code>) describing the page.",
    why: "Structured data is how you tell search engines exactly what the page is — an article, a product, a FAQ, an organization. It unlocks rich results (stars, prices, FAQs) that raise click-through, and it's increasingly what AI-powered search surfaces read.",
    fixes: [
      "Add a JSON-LD block matching the page type: <code>Article</code>, <code>Product</code>, <code>FAQPage</code>, <code>Organization</code>, etc.",
      "Only mark up content that is actually visible on the page.",
      "Validate with Google's Rich Results Test after publishing.",
    ],
    ai: "Optia Pro can generate a page-appropriate JSON-LD schema block for you.",
  },
  {
    category: "technical",
    slug: "code-minification",
    title: "Code minification",
    checks: ["Code is minified"],
    what: "Optia samples the page's JavaScript and CSS resources and estimates whether they are minified.",
    why: "Unminified assets ship comments, whitespace, and long identifiers the browser doesn't need. Minification routinely cuts 30–60% of transfer size, which speeds up parsing and improves the Core Web Vitals that feed ranking.",
    fixes: [
      "Turn on minification in your bundler or framework's production build (Vite, webpack, Next.js do this by default).",
      "Make sure you're deploying the production build, not a development one.",
      "Enable gzip or Brotli compression on the server — it multiplies the gains.",
    ],
  },
];

const pageHref = (p) => `${p.category}/${p.slug}.html`;

function baseStyles() {
  return `
  :root {
    --brand: #4f46e5; --brand-deep: #3730a3; --night: #1e1b4b;
    --ink: #111827; --muted: #4b5563; --faint: #9ca3af;
    --surface: #ffffff; --canvas: #f6f7fb; --border: #e5e7eb; --good: #10b981;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: var(--ink); background: var(--canvas); line-height: 1.65; }
  a { color: var(--brand); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .topbar { background: radial-gradient(120% 200% at 15% 0%, var(--brand) 0%, var(--brand-deep) 65%, var(--night) 100%); color: #fff; padding: 20px 24px; }
  .topbar .inner { max-width: 820px; margin: 0 auto; display: flex; align-items: baseline; gap: 16px; }
  .wordmark { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; color: #fff; }
  .wordmark::after { content: ""; display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #a5b4fc; margin-left: 3px; }
  .topbar a.docs-home { color: rgba(255,255,255,0.85); font-size: 14px; }
  main { max-width: 820px; margin: 0 auto; padding: 40px 24px 64px; }
  code { background: #eef0f6; border: 1px solid var(--border); border-radius: 5px; padding: 1px 5px; font-size: 0.9em; }
  footer { border-top: 1px solid var(--border); padding: 28px 24px 40px; text-align: center; font-size: 14px; color: var(--muted); }
  footer .links { margin-bottom: 8px; }
  footer .links a { margin: 0 10px; }`;
}

function footer(rootPrefix) {
  return `  <footer>
    <div class="links">
      <a href="${rootPrefix}index.html">Optia</a>
      <a href="${rootPrefix}docs/index.html">SEO Docs</a>
      <a href="https://github.com/PMDevSolutions/Optia">GitHub</a>
      <a href="https://github.com/PMDevSolutions/Optia/issues">Support</a>
      <a href="${rootPrefix}privacy.html">Privacy Policy</a>
    </div>
    <div>© 2026 Paul Mulligan Development Solutions (PMDS)</div>
  </footer>`;
}

function renderPage(p) {
  const rootPrefix = "../../";
  const aiBlock = p.ai
    ? `\n    <div class="ai-tip"><strong>Fix it with Optia:</strong> ${p.ai}</div>`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${p.title} — Optia SEO Docs</title>
<meta name="description" content="What Optia's &quot;${p.checks[0]}&quot; check measures, why it matters for SEO, and how to fix it." />
<style>${baseStyles(2)}
  .crumbs { font-size: 13.5px; color: var(--faint); margin-bottom: 14px; }
  .crumbs a { color: var(--muted); }
  h1 { font-size: clamp(26px, 4vw, 34px); letter-spacing: -0.02em; line-height: 1.2; margin-bottom: 10px; }
  .checks { margin: 14px 0 30px; display: flex; flex-wrap: wrap; gap: 8px; }
  .check-pill { background: var(--surface); border: 1px solid var(--border); border-radius: 999px; padding: 4px 12px; font-size: 13px; color: var(--muted); }
  .check-pill::before { content: "✓"; color: var(--good); font-weight: 700; margin-right: 6px; }
  h2 { font-size: 20px; letter-spacing: -0.01em; margin: 30px 0 10px; }
  p { color: var(--ink); margin-bottom: 12px; }
  ul { margin: 0 0 12px 22px; }
  li { margin-bottom: 8px; }
  .ai-tip { background: var(--surface); border: 1px solid var(--brand); border-radius: 12px; padding: 16px 18px; margin-top: 30px; font-size: 15px; box-shadow: 0 4px 24px rgba(79,70,229,0.10); }
  .backlink { display: inline-block; margin-top: 34px; font-size: 14.5px; }
</style>
</head>
<body>
  <header class="topbar">
    <div class="inner">
      <a class="wordmark" href="${rootPrefix}index.html">Optia</a>
      <a class="docs-home" href="../index.html">SEO Docs</a>
    </div>
  </header>
  <main>
    <div class="crumbs"><a href="../index.html">Docs</a> · ${CATEGORIES[p.category]}</div>
    <h1>${p.title}</h1>
    <div class="checks">${p.checks.map((c) => `<span class="check-pill">${c}</span>`).join("")}</div>

    <h2>What this check looks at</h2>
    <p>${p.what}</p>

    <h2>Why it matters</h2>
    <p>${p.why}</p>

    <h2>How to fix it</h2>
    <ul>
${p.fixes.map((f) => `      <li>${f}</li>`).join("\n")}
    </ul>${aiBlock}

    <a class="backlink" href="../index.html">← All SEO checks</a>
  </main>
${footer(rootPrefix)}
</body>
</html>
`;
}

function renderIndex() {
  const rootPrefix = "../";
  const byCategory = Object.keys(CATEGORIES)
    .map((cat) => {
      const pages = PAGES.filter((p) => p.category === cat);
      const items = pages
        .map(
          (p) =>
            `        <li><a href="${pageHref(p)}">${p.title}</a><span class="covers">${p.checks.join(" · ")}</span></li>`,
        )
        .join("\n");
      return `      <section>
        <h2>${CATEGORIES[cat]}</h2>
        <ul>
${items}
        </ul>
      </section>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Optia SEO Docs — every check explained</title>
<meta name="description" content="What each of Optia's SEO checks measures, why it matters, and how to fix it — titles, meta descriptions, headings, images, links, and technical SEO." />
<style>${baseStyles(1)}
  .intro h1 { font-size: clamp(28px, 4.5vw, 38px); letter-spacing: -0.02em; margin-bottom: 10px; }
  .intro p { color: var(--muted); max-width: 640px; margin-bottom: 34px; }
  section { margin-bottom: 34px; }
  section h2 { font-size: 15px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--faint); margin-bottom: 12px; }
  section ul { list-style: none; display: grid; gap: 10px; }
  section li { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 18px; }
  section li a { font-weight: 600; font-size: 16px; display: block; }
  section li .covers { display: block; font-size: 13px; color: var(--faint); margin-top: 2px; }
</style>
</head>
<body>
  <header class="topbar">
    <div class="inner">
      <a class="wordmark" href="${rootPrefix}index.html">Optia</a>
      <a class="docs-home" href="index.html">SEO Docs</a>
    </div>
  </header>
  <main class="intro">
    <h1>Every Optia check, explained</h1>
    <p>Optia scores 25 on-page SEO checks across meta tags, content, links, images, and technical SEO. Each guide below covers what the check measures, why it matters, and exactly how to fix it.</p>
${byCategory}
  </main>
${footer(rootPrefix)}
</body>
</html>
`;
}

rmSync(DOCS_DIR, { recursive: true, force: true });
mkdirSync(DOCS_DIR, { recursive: true });
for (const cat of Object.keys(CATEGORIES)) mkdirSync(join(DOCS_DIR, cat), { recursive: true });

for (const p of PAGES) {
  writeFileSync(join(DOCS_DIR, pageHref(p)), renderPage(p));
}
writeFileSync(join(DOCS_DIR, "index.html"), renderIndex());

console.log(`Wrote ${PAGES.length} doc pages + index to ${DOCS_DIR}`);
