# Product Hunt launch kit

Prepared 2026-09-08. **Status: entered in Product Hunt and scheduled for Wednesday 2026-09-09 at 12:01 AM PDT** (confirmed on the My products page). Launch page https://www.producthunt.com/products/optia, edit at https://www.producthunt.com/posts/optia/edit, launch-day dashboard at https://www.producthunt.com/products/optia/optia/prelaunch. Product Hunt account: GitHub sign-in (PAMulligan), username pamulligan, email paul@pmds.info. Product Hunt rejected the Chrome Web Store URL as the primary link, so pmds.info/products/optia is primary and the store link is the additional link. Everything below is what was entered. Copy follows brand-guidelines.json (product voice on the listing, Paul's first-person voice in the maker comment).

## Go / no-go check (done 2026-09-08)

- GitHub: 0 open issues on Optia and optia-backend as of the 2026-09-04 sweep, none opened since.
- Chrome Web Store: 1 rating (5 stars), no written reviews, no support tickets. Version 1.1.1 live.
- Open question from the 9/4 sweep: no free-tier AI calls were logged Sep 1 through Sep 4. Before launch, install from the store in a clean profile and generate one AI title to confirm the free path works. If it fails, slide the launch.

## Launch form fields

**Name:** Optia

**Tagline (60 max):** Instant SEO score and AI recommendations for any page

**Links:**
- Primary: https://chromewebstore.google.com/detail/optia/gnlidlpidaoalbbmekofjednjkhhmehn
- Website: https://pmds.info/products/optia
- Support: https://github.com/PMDevSolutions/Optia/issues

**Description (260 max):**
Optia is a Chrome extension that scores any page's on-page SEO from 0 to 100 and lists what to fix, by priority. One-click AI titles, meta descriptions, and alt text, powered by Claude. Analysis runs locally. 25 AI suggestions a month free, no account needed.

**Topics (3):** Chrome Extensions, SEO, Marketing

**Pricing:** Free, with paid plans (Pro $5/month or $50/year)

**Makers:** Paul Mulligan (solo). No hunter; self-launch.

**Launch time:** Wednesday 2026-09-09, 12:01 AM PT (schedule in the form; do not post live during the day).

**Thumbnail (240x240):** `marketing/store-assets/out/ph-thumbnail-240.png` (rendered from `app/icons/icon.svg`).

**Gallery, in this order:**
1. `marketing/store-assets/out/optia-demo.gif` (1270x714, 18 s: keyword typed, score revealed, AI title generated and copied)
2. `marketing/store-assets/out/screenshot-1-score.png`
3. `marketing/store-assets/out/screenshot-2-checks.png`
4. `marketing/store-assets/out/screenshot-3-setup.png`
5. `marketing/store-assets/out/screenshot-4-pro.png`
6. `marketing/store-assets/out/screenshot-5-options.png`

**Video (YouTube link field):** https://youtu.be/Ac-pEtRYlsQ

## First comment (maker), post the moment the launch goes live

Hi Product Hunt, I'm Paul. I build websites for small businesses in Baltimore, and Optia is the tool I wanted while doing that work.

The problem: most SEO tools either cost more than a small business wants to pay or make you create an account just to see basic on-page checks. I wanted something that runs in the browser, next to the page, and tells me what to fix right now.

What Optia does:

- Enter your target keyword and click Optimize my SEO.
- Get a 0 to 100 score with every check labeled High or Medium priority.
- See how the keyword is used across the title, meta description, headings, URL, alt text, and body.
- Click once for an AI-written title, meta description, H2, or alt text, powered by Claude.

What is free: all of the analysis, on every page, unlimited. Plus 25 AI suggestions a month with no account and no API key.

What Pro costs: $5 a month or $50 a year. It raises AI to 1,000 a month, adds page-type-aware analysis, multi-language output, and schema suggestions, and lets you bring your own Anthropic key for unlimited use.

Privacy: the analysis runs locally in your browser. An AI request sends only the snippet being improved, like the current title and your keyword. No tracking, no analytics, no ads.

I'm a one-person shop, so I read every comment. The most useful thing you can tell me is which check you wish it ran that it does not. Thanks for looking.

## Replies to have ready

**"How is this different from the free SEO extensions already out there?"**
Most of them dump every check on you with equal weight. Optia labels each one High or Medium so you fix the things that move rankings first, and it writes the replacement title or meta description for you instead of telling you to go write one.

**"Why Claude and not OpenAI?"**
The first version was bring-your-own OpenAI key. When I built the hosted free tier I standardized on Claude for the suggestions and kept bring-your-own-key as a Pro option, now for Anthropic keys. (Paul: add your own reason if you have one; do not claim a head-to-head test unless you ran one.)

**"Is my page content sent anywhere?"**
Only when you ask for an AI suggestion, and only the snippet being improved plus your keyword. The scoring never leaves the browser. Full policy: https://pmdevsolutions.github.io/Optia/privacy.html

**"Firefox or Edge?"**
Chrome only today. Edge can usually load Chrome Web Store extensions, but I have not tested Optia there, so I will not promise it. There is no Firefox build yet. If enough people ask here, that changes the order.

**"Does it work on Webflow / WordPress / Shopify?"**
Yes. It analyzes the rendered page, so any published site works. It does not edit the site for you; you copy the suggestion into your CMS.

## Launch-day amplification (separate task, due 2026-09-09)

- LinkedIn: short post linking the PH page, drafted in the LinkedIn composer.
- X: one post linking the PH page.
- Reply to every PH comment through the day.
- Do not ask for upvotes anywhere. Ask for feedback and link the page.
