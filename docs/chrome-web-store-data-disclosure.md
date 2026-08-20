# Chrome Web Store — Privacy Practices Disclosure

Exact answers for the **Privacy practices** tab in the CWS Developer Dashboard, derived from the extension's real data flows. Keep in sync with `docs/privacy-policy.md`. The dashboard rejects listings whose disclosures contradict observed behavior, so update this file whenever a data flow changes.

## Single purpose (repeated here for convenience)

On-page SEO analysis: score the page the user is viewing against SEO best practices for a user-provided keyword, and generate suggested improvements (titles, meta descriptions, headings, alt text) on request.

## Data collection questionnaire

For each category the dashboard asks about, declare:

| Dashboard category | Collected? | Detail |
|---|---|---|
| Personally identifiable information | **No** | No name, address, email, or ID is collected by the extension. (Stripe collects billing details during Pro checkout on Stripe-hosted pages — outside the extension.) |
| Health information | No | — |
| Financial and payment information | **No** | Payment is handled entirely by Stripe's hosted checkout/portal; the extension never sees card data. |
| Authentication information | **Yes** | A Pro license key and a signed entitlement token are sent to our backend to activate/refresh the license. A user's optional Anthropic API key is stored locally only and sent only to Anthropic — never to us. |
| Personal communications | No | — |
| Location | No | No location data; standard IP handling by our CDN/backend is not used for geolocation features. |
| Web history | **No** | The extension does not record browsing history. It reads a page's content only when the user runs an analysis on that page. |
| User activity | **No** | No analytics, telemetry, clickstream, or usage tracking. The only counters are anonymous quota counts (install ID / license) needed to meter the AI allowance. |
| Website content | **Yes** | When the user requests an AI recommendation, the target keyword and the relevant page snippets (title/heading/alt-text context) are sent to our AI service — or directly to Anthropic in bring-your-own-key mode — solely to generate the suggestion. |

## Certifications (check all three)

- ✅ I do **not** sell or transfer user data to third parties, outside of the approved use cases
- ✅ I do **not** use or transfer user data for purposes that are unrelated to my item's single purpose
- ✅ I do **not** use or transfer user data to determine creditworthiness or for lending purposes

## Limited Use

Optia's use of website content complies with the Limited Use policy: data sent to the AI service is used only to provide the user-requested feature (generating the SEO suggestion), is not used for advertising, and is not sold.

## Remote code

Declare **No remote code**. All executable code ships in the package. Network calls fetch data (JSON) only:

- `https://api.optia-api.com` — AI proxy, license activation/refresh, billing portal session (production)
- `https://api.anthropic.com` — direct AI calls in Pro bring-your-own-key mode only
- `https://checkout.stripe.com` / billing portal — opened as pages, not fetched into the extension

## Permission justifications

Copy from the table in `docs/chrome-web-store-listing.md` (kept there so listing copy and justifications travel together).
