# Free vs Pro Feature Gating

Optia's freemium split, and how each surface is wired to the client-side
entitlement layer (`app/src/lib/entitlement-store.ts`). Every gate reads a flag
from that store — never an ad-hoc `apiKey` check or raw license data.

## The matrix

| Feature | Free | Pro | Gate (entitlement-store flag) |
|---|---|---|---|
| On-page SEO scoring | ✅ Full | ✅ Full | *ungated — never gate* |
| Score breakdown (per-check detail) | ✅ Full | ✅ Full | *ungated — never gate* |
| AI recommendations (title, meta, H1, URL, intro, H2, alt text) | ✅ Capped monthly, via hosted proxy | ✅ Higher cap via proxy, or unlimited with own key | `useCanUseAI()` / `useAiStatus()` |
| Advanced analysis (page type, secondary keywords) | ❌ | ✅ | `canUseAdvancedOptions` |
| Multi-language AI output | ❌ English only | ✅ Any supported language | `canUseMultiLanguage` |
| Schema markup generation | ❌ | ✅ | `canUseSchema` |
| Bring your own Anthropic key | ❌ | ✅ | `canBringOwnKey` |

All four `canUse*` / `canBringOwnKey` flags are `true` only for a verified Pro
entitlement (they are derived from `isPro` in `hydrateEntitlement`). Scoring and
the score breakdown are deliberately never gated.

## How AI recommendations resolve (three paths)

`useAiStatus()` collapses provider + entitlement into one of four modes; the AI
facade (`app/src/lib/ai.ts`) routes each generation accordingly:

| Mode | When | Path | Metering |
|---|---|---|---|
| `byok` | Pro **and** an Anthropic key is set | Browser → Anthropic directly (`anthropic.ts`, `claude-opus-4-8`) | Unlimited, unmetered (user's own key) |
| `pro` | Pro, no key | Hosted proxy `POST /ai/generate` with `X-Optia-Entitlement` | Server-metered, higher monthly cap |
| `free` | Not Pro | Hosted proxy `POST /ai/generate` with install id | Server-metered, capped monthly allowance |
| `locked` | Quota exhausted with no other path | — | AI buttons disabled + upsell |

Key rules:

- **BYO key is a Pro feature.** A stored Anthropic key only unlocks the direct
  path when `isPro` is true, so a free user can never self-serve uncapped AI.
- **The server is the quota authority.** Every `/ai/generate` response returns
  `quota: { limit, remaining, period }`, which the client caches
  (`pro_ai_quota` / `free_ai_quota` in `chrome.storage.local`) and reflects in
  `aiQuotaRemaining` / `freeAiRemaining`. The client never mints quota.
- **Free tier is genuinely useful, no dead ends.** Free users get full scoring
  plus a monthly AI allowance. When the allowance is exhausted, the AI controls
  disable with a friendly "upgrade for more" message rather than erroring.

## Notes and known limitations

- **Quota period is monthly, not daily.** The original issue proposed a daily
  free cap; the shipped backend (`optia-backend` `/ai/generate`) meters a
  **monthly** allowance (`getFreeMonthlyQuota`, period `YYYY-MM`). The client
  follows the backend.
- **Advanced context only applies on the BYO-key path.** The hosted proxy
  accepts only `{ checkId, keyword, context }`; page type, secondary keywords,
  and language are forwarded to Anthropic only on the direct path. Pro users who
  want advanced context to shape output should add their own key.
- **Provider is Anthropic.** The former OpenAI integration was migrated to the
  Anthropic SDK (`@anthropic-ai/sdk`) in this change; the stored key moved from
  `openai_api_key` to `anthropic_api_key`.
