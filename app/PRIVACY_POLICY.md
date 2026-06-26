# Privacy Policy — Optia

**Last updated:** April 1, 2026

Optia is a Chrome browser extension that analyzes web pages for SEO issues and provides recommendations. This privacy policy explains what data the extension accesses, how it is used, and how it is stored.

## Data the Extension Accesses

When you click "Analyze" on a page, the extension reads the following from the current tab:

- Page title, meta tags, and heading structure
- Image elements and their alt text attributes
- Link counts (internal vs. external)
- Open Graph and Twitter Card meta tags
- Structured data (JSON-LD schema markup)
- Word count and paragraph content
- The page URL

This data is used **only** to generate the SEO score and recommendations shown in the extension's side panel. It is never sent to our servers or any third party other than OpenAI (see below).

## OpenAI API Key and AI Features

The extension's AI-powered recommendations (title suggestions, meta description rewrites, alt text generation, etc.) require an OpenAI API key that **you** provide.

- Your API key is stored locally in your browser's `chrome.storage.local`. It never leaves your device except when making direct API calls from your browser to OpenAI's servers (`api.openai.com`).
- When you request an AI recommendation, a small amount of page context (e.g., the current title, keyword, or image src) is sent to OpenAI's API to generate the suggestion. Only the minimum context needed for the specific recommendation is sent.
- We do not proxy, log, or store any data sent to or received from OpenAI. Your browser communicates directly with OpenAI's API.
- You can delete your stored API key at any time from the extension's Settings page.

For OpenAI's own data handling practices, see [OpenAI's Privacy Policy](https://openai.com/policies/privacy-policy) and [API Data Usage Policy](https://openai.com/policies/api-data-usage-policies).

## Data Storage

All extension data is stored locally on your device using Chrome's built-in storage APIs:

| Data | Storage Location | Purpose |
|------|-----------------|---------|
| OpenAI API key | `chrome.storage.local` | Authenticating AI recommendation requests |
| Language preference | `chrome.storage.local` | Generating recommendations in your preferred language |
| Per-tab analysis results | `chrome.storage.session` | Preserving results while navigating between tabs |

No data is stored on external servers. No cookies are set. No analytics or tracking scripts are used.

## Permissions Explained

| Permission | Why It's Needed |
|------------|----------------|
| `tabs` | To identify the active tab and its URL for analysis |
| `sidePanel` | To display the extension's UI in Chrome's side panel |
| `storage` | To save your API key and preferences locally |
| `scripting` | To read page content (DOM) for SEO analysis |
| Host permission (`<all_urls>`) | To analyze any website you choose to scan |

## Data Sharing

Optia does **not**:

- Collect or transmit personal information
- Use analytics, telemetry, or tracking of any kind
- Share data with third parties (other than direct OpenAI API calls initiated by you)
- Store any data on external servers
- Access browsing history beyond the currently analyzed tab

## Children's Privacy

This extension is not directed at children under 13 and does not knowingly collect information from children.

## Changes to This Policy

If this policy is updated, the new version will be published with the extension update and the "Last updated" date above will change.

## Contact

If you have questions about this privacy policy, please open an issue on the project's GitHub repository.
