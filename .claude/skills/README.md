# Skills Catalog

Project-specific skills for the **Optia** MV3 Chrome extension. Skills auto-trigger when relevant keywords appear; they encode this repo's real, verified patterns (not generic advice).

| Skill | Purpose | Triggers |
|-------|---------|----------|
| **chrome-extension-dev** | The orchestrating guide for the extension: message catalog (SW ↔ content ↔ side panel), `chrome.storage` schema, service-worker lifecycle, side-panel lifecycle, the two-extractor rule, dev-mode detection, and a "wire a new message" checklist. | chrome extension, manifest, service worker, content script, side panel, chrome.storage, message passing, MV3 |
| **testing-chrome-extension** | The repo's working Vitest patterns: how `chrome.*` is mocked (`src/test/setup.ts`), the import-time load-order rule for SW/storage tests, OpenAI SDK mocking (fake-timers vs real backoff), and RTL/Zustand patterns. | write/fix tests, mock chrome, test the service worker, hanging test, vitest |

## Related commands

- `/add-seo-check` — ordered, cross-file workflow to add a new SEO check (keeps the ~8 sync-sensitive files consistent).
- `/release-extension` — the one correct path to cut a Chrome Web Store release (version sync + zip + store checklist).
- `/lint`, `/test` — quality commands.

## Skill file structure

```yaml
---
name: skill-name
description: One line — what it is + when to use it / trigger keywords.
---

# Title
...body...
```

To add a skill, create `.claude/skills/<name>/SKILL.md`. Keep it grounded in real files (cite `file:line`), concise, and skimmable. Use the **agent-expert** / **command-expert** agents when authoring new agents or commands.
