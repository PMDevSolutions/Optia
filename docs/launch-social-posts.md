# Launch Day Social Media Posts

> Rewritten 2026-08 for the freemium launch: AI is served by Claude (Anthropic) through Optia's hosted service — free users get 25 AI recommendations/month with no account or API key; Pro ($5/mo or $50/yr) raises that to 1,000/month and adds bring-your-own-Anthropic-key (unlimited), Advanced Analysis, multi-language output, and schema recommendations. Do not reuse the pre-freemium copy (OpenAI/BYO-only, "open source", old GitHub links).

## LinkedIn

### Post 1 — Announcement

I just shipped my first Chrome extension: Optia.

It analyzes any web page for SEO issues and gives you a score from 0–100 with actionable recommendations. Enter your target keyword, and it shows you exactly what's working and what needs fixing across titles, meta descriptions, headings, images, links, structured data, and more.

The AI part: one-click suggested titles, meta descriptions, and alt text — tailored to your page content and powered by Claude. 25 AI recommendations a month are free, no account or API key needed. Optia Pro ($5/month) raises that to 1,000 and adds page-type-aware analysis, multi-language output, and the option to plug in your own Anthropic key for unlimited AI.

Built this because I got tired of switching between SEO tools that either cost too much or required accounts just to see basic recommendations.

The analysis itself is free, unlimited, and runs locally in your browser.

[Chrome Web Store link]

---

### Post 2 — Behind the Build

Shipped something new today: Optia, a Chrome extension for on-page SEO analysis.

What it does:
• Instant SEO score (0–100) with priority-labeled issues
• Keyword tracking across title, meta, headings, URL, alt text, and content
• AI suggestions for titles, meta descriptions, and alt text — 25/month free, powered by Claude
• Works on any website — runs in Chrome's side panel

What made this project different:
• Privacy-first: SEO analysis runs locally; AI requests send only the relevant page snippets, and nothing else ever leaves your browser
• No accounts for the free tier, no tracking, no analytics
• Freemium done honestly: the analyzer is fully free; you pay only for more AI
• Built with React + TypeScript + Vite as a Manifest V3 extension, with a Cloudflare Workers backend for billing and the AI proxy

If you work with SEO or just want to improve your site's search visibility, give it a try and let me know what you think.

[Chrome Web Store link]

---

## Reddit

### r/SEO

**Title:** I built a Chrome extension for on-page SEO analysis with a free AI tier — Optia

**Body:**

Hey r/SEO,

I built a Chrome extension that analyzes any web page for SEO issues and gives you a score from 0–100 with actionable recommendations.

**What it does:**
- Enter your target keyword and click "Optimize my SEO"
- See how your keyword is used across title, meta description, headings, URL, image alt text, and body content
- Get a breakdown of passed checks vs. items to improve
- Every issue is labeled High Priority or Medium so you know where to focus

**AI features:**
- One-click suggested titles, meta descriptions, H2s, and alt text, powered by Claude
- 25 AI recommendations a month free — no account, no API key
- Pro ($5/mo) bumps it to 1,000/month, adds page-type-aware analysis + multi-language output, or bring your own Anthropic key for unlimited

**Categories it checks:**
Meta Tags, Headings, Images, Links, Content Quality, Structured Data (JSON-LD), Open Graph, and Twitter Cards

**Privacy:**
The analysis itself runs locally in your browser. AI requests send only the relevant page snippets (your keyword + the element being improved). No tracking, no analytics, and a Pro user's own API key never touches our servers.

[Chrome Web Store link]

Would love feedback from this community — what checks would you want to see added?

---

### r/SideProject

**Title:** I shipped my first freemium Chrome extension — Optia (SEO analysis + AI)

**Body:**

Just launched Optia on the Chrome Web Store.

**The problem:** I was tired of SEO tools that either required paid accounts or sent my data to their servers just to get basic on-page recommendations.

**The solution:** A Chrome extension that:
- Analyzes any web page for SEO issues, entirely locally
- Gives you a 0–100 score with priority-labeled recommendations
- Generates AI titles, meta descriptions, and alt text (Claude) — 25/month free, 1,000/month on Pro, unlimited if you bring your own Anthropic key

**Tech stack:**
- React + TypeScript + Vite, Manifest V3 (side panel UI)
- Cloudflare Workers + Hono backend: Stripe billing, Ed25519-signed license entitlements, metered AI proxy
- Vitest + Playwright extension E2E

**What I learned:**
- MV3 side panels and content scripts have real quirks — test against the built extension, not just unit tests
- A freemium quota is a distributed-systems problem: the server must be the quota authority, the client just caches
- Shipping is the hardest part

[Chrome Web Store link]

Would love feedback — what features would make this more useful for you?

---

## Twitter/X

🚀 Just shipped Optia — a Chrome extension for on-page SEO analysis.

Enter your keyword, get a 0–100 score, and see exactly what to fix across titles, meta, headings, images, and structured data.

25 free AI suggestions/month powered by Claude — no account needed. Pro for more, or bring your own key.

[Chrome Web Store link]

---

## Webflow Community

**Title:** Chrome extension for SEO analysis with free AI suggestions — Optia

**Body:**

Hey everyone,

I built a Chrome extension that I've been using alongside my Webflow projects and wanted to share it with the community.

**Optia** analyzes any web page for SEO issues and gives you a clear score with actionable recommendations.

**How it works:**
1. Open any page (including your published Webflow site)
2. Enter your target keyword
3. Click "Optimize my SEO"
4. Get a 0–100 score with a breakdown of what's working and what needs improvement

**What it checks:**
- Meta tags (title, description)
- Headings (H1, H2 structure)
- Images (alt text)
- Links (internal, external)
- Content quality
- Structured data (JSON-LD)
- Open Graph and Twitter Cards

**AI features:**
One-click suggestions for titles, meta descriptions, and image alt text, powered by Claude. 25 a month are free with no account or API key; Optia Pro ($5/mo) raises that to 1,000, adds page-type-aware analysis and multi-language output, or plug in your own Anthropic key for unlimited.

**Privacy:**
The analysis runs locally in your browser — AI requests send only the snippet being improved. No accounts for the free tier, no tracking.

[Chrome Web Store link]

I'd love to hear what SEO checks would be most useful for Webflow users specifically. Happy to add features based on feedback!
