import {
  getRefreshFailureCount,
  getValidEntitlement,
  hasStoredLicenseKey,
  refreshNow,
  ENTITLEMENT_TOKEN_KEY,
  LICENSE_KEY_KEY,
  type EntitlementClaims,
} from "@/lib/entitlement";

// Background auto-refresh: keeps the cached entitlement fresh so the UI never
// has to refresh inline. Tokens live ≤24h; we refresh at 75% of the lifetime
// (never later than 1h before expiry) and back off exponentially on failure,
// keeping the last valid token until its exp actually passes.

export const ENTITLEMENT_ALARM = "entitlement-refresh";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const ASSUMED_LIFETIME_MS = 24 * HOUR_MS; // when a token carries no iat
const MAX_RETRY_MINUTES = 360;

/** When to refresh: 75% through the token's lifetime, at latest exp − 1h. */
function refreshTimeMs(claims: EntitlementClaims): number {
  const expMs = claims.exp * 1000;
  const issuedMs = claims.iat ? claims.iat * 1000 : expMs - ASSUMED_LIFETIME_MS;
  return Math.min(expMs - HOUR_MS, issuedMs + 0.75 * (expMs - issuedMs));
}

function scheduleFromClaims(claims: EntitlementClaims): void {
  const when = Math.max(Date.now() + MINUTE_MS, refreshTimeMs(claims));
  chrome.alarms.create(ENTITLEMENT_ALARM, { when });
}

/**
 * Backoff after a soft failure (offline, 5xx, 429): 5min · 2^(n−1), capped at
 * 6h — and never later than 5min before a still-valid token expires, so we get
 * a last refresh attempt in before downgrading to free.
 */
function scheduleRetry(failures: number, claims: EntitlementClaims | null): void {
  const delayMs = Math.min(5 * 2 ** Math.max(failures - 1, 0), MAX_RETRY_MINUTES) * MINUTE_MS;
  let when = Date.now() + delayMs;
  if (claims) {
    when = Math.min(when, claims.exp * 1000 - 5 * MINUTE_MS);
  }
  chrome.alarms.create(ENTITLEMENT_ALARM, { when: Math.max(when, Date.now() + MINUTE_MS) });
}

async function refreshAndReschedule(): Promise<void> {
  const claims = await refreshNow();
  const failures = await getRefreshFailureCount();
  if (failures > 0) {
    // Soft failure: claims (if any) are the cached, still-valid entitlement
    if (await hasStoredLicenseKey()) {
      scheduleRetry(failures, claims);
    } else {
      await chrome.alarms.clear(ENTITLEMENT_ALARM);
    }
    return;
  }
  if (claims) {
    scheduleFromClaims(claims);
    return;
  }
  // Revoked/unknown license (state was cleared) or no license at all
  await chrome.alarms.clear(ENTITLEMENT_ALARM);
}

/** Arms the alarm from current state; refreshes immediately when overdue. */
export async function ensureScheduled(): Promise<void> {
  if (!(await hasStoredLicenseKey())) {
    await chrome.alarms.clear(ENTITLEMENT_ALARM);
    return;
  }
  const claims = await getValidEntitlement();
  if (!claims || Date.now() >= refreshTimeMs(claims)) {
    await refreshAndReschedule();
    return;
  }
  scheduleFromClaims(claims);
}

/** Registers all background listeners; call once at service-worker top level. */
export function registerEntitlementAlarms(): void {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ENTITLEMENT_ALARM) void refreshAndReschedule();
  });
  chrome.runtime.onInstalled.addListener(() => void ensureScheduled());
  chrome.runtime.onStartup.addListener(() => void ensureScheduled());
  // Activation/deactivation in the options page arms or clears the alarm here —
  // no message passing needed, storage is the shared channel.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[ENTITLEMENT_TOKEN_KEY] || changes[LICENSE_KEY_KEY]) {
      void ensureScheduled();
    }
  });
}
