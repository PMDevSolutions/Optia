import { BACKEND_BASE_URL } from "@/lib/entitlement-keys";
import { currentAiPeriod, getInstallId } from "@/lib/entitlement";
import { getStorageItem, setStorageItem } from "@/lib/storage";

// Anonymous usage counts (#80; backend half optia-backend#30). Each completed
// page analysis adds one to this install's count for the calendar month, kept
// in local storage. At most once a day, right after an analysis, the running
// totals go to POST /usage/analysis as { installId, period, count } and nothing
// else: no URLs, no page content, no scores. The backend keeps the highest
// count it has seen for a month, so re-sending a total is harmless. Turning
// off "Share anonymous usage counts" in Options keeps the local count (Options
// still shows it) and stops every report.

export const ANALYSIS_COUNTS_KEY = "usage_analyses";
export const USAGE_REPORT_KEY = "usage_report";
export const SHARE_USAGE_KEY = "share_usage_counts";

const DAY_MS = 24 * 60 * 60 * 1000;
// The backend rejects counts above this; a real install never gets near it.
const MAX_REPORTED_COUNT = 10_000;

/** Pages analyzed per month ("YYYY-MM"), for the current and previous month only. */
type AnalysisCounts = Record<string, number>;

interface UsageReportState {
  /** When a report was last attempted (ms epoch). A failed attempt counts too. */
  lastAttemptAt: number;
  /** The count the backend last accepted, per month. */
  sent: Record<string, number>;
}

/** The months a report can cover: the backend accepts the current one and the one before. */
function reportablePeriods(now: Date): [previous: string, current: string] {
  const previousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return [currentAiPeriod(previousMonth), currentAiPeriod(now)];
}

/** Drops months older than the previous one; that is the whole month rollover. */
function keepReportable(byPeriod: Record<string, number>, now: Date): Record<string, number> {
  const kept: Record<string, number> = {};
  for (const period of reportablePeriods(now)) {
    if (typeof byPeriod[period] === "number") kept[period] = byPeriod[period];
  }
  return kept;
}

// Increments run one at a time, so two analyses finishing together never read
// the same total and lose one.
let recordQueue: Promise<unknown> = Promise.resolve();

/** Adds one completed page analysis to this month's count. */
export function recordAnalysis(now: Date = new Date()): Promise<void> {
  const next = recordQueue.then(async () => {
    const stored = (await getStorageItem<AnalysisCounts>(ANALYSIS_COUNTS_KEY)) ?? {};
    const counts = keepReportable(stored, now);
    const period = currentAiPeriod(now);
    counts[period] = (counts[period] ?? 0) + 1;
    await setStorageItem<AnalysisCounts>(ANALYSIS_COUNTS_KEY, counts);
  });
  recordQueue = next.catch(() => undefined);
  return next;
}

/** Pages analyzed on this install in the current calendar month. */
export async function getMonthlyAnalysisCount(now: Date = new Date()): Promise<number> {
  const counts = await getStorageItem<AnalysisCounts>(ANALYSIS_COUNTS_KEY);
  return counts?.[currentAiPeriod(now)] ?? 0;
}

/** The "Share anonymous usage counts" setting. Unset means on. */
export async function isUsageSharingEnabled(): Promise<boolean> {
  return (await getStorageItem<boolean>(SHARE_USAGE_KEY)) !== false;
}

export async function setUsageSharingEnabled(enabled: boolean): Promise<void> {
  await setStorageItem<boolean>(SHARE_USAGE_KEY, enabled);
}

let reportInFlight: Promise<void> | null = null;

/**
 * Sends the month's running total, plus last month's when it grew after that
 * month's final report, if sharing is on and no report was attempted in the
 * past 24 hours. Never throws: a failed report waits for the next day.
 */
export function reportUsageIfDue(now: Date = new Date()): Promise<void> {
  reportInFlight ??= sendDueReport(now)
    .catch(() => undefined)
    .finally(() => {
      reportInFlight = null;
    });
  return reportInFlight;
}

async function sendDueReport(now: Date): Promise<void> {
  if (!(await isUsageSharingEnabled())) return;
  const state = await getStorageItem<UsageReportState>(USAGE_REPORT_KEY);
  const sinceLastAttempt = now.getTime() - (state?.lastAttemptAt ?? 0);
  // A negative gap means the clock moved back; treat that as due rather than stall.
  if (sinceLastAttempt >= 0 && sinceLastAttempt < DAY_MS) return;

  const counts = (await getStorageItem<AnalysisCounts>(ANALYSIS_COUNTS_KEY)) ?? {};
  const sent = keepReportable(state?.sent ?? {}, now);
  const due = reportablePeriods(now)
    .map((period) => ({ period, count: Math.min(counts[period] ?? 0, MAX_REPORTED_COUNT) }))
    .filter(({ period, count }) => count > (sent[period] ?? 0));
  if (due.length === 0) return;

  // Record the attempt before sending, so a failure (offline, an error status,
  // the endpoint not live yet) waits a day instead of retrying on every analysis.
  await setStorageItem<UsageReportState>(USAGE_REPORT_KEY, { lastAttemptAt: now.getTime(), sent });
  const installId = await getInstallId();
  for (const { period, count } of due) {
    if (await postAnalysisCount(installId, period, count)) sent[period] = count;
  }
  await setStorageItem<UsageReportState>(USAGE_REPORT_KEY, { lastAttemptAt: now.getTime(), sent });
}

/** POSTs one month's total; true when the backend accepted it. */
async function postAnalysisCount(installId: string, period: string, count: number): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/usage/analysis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ installId, period, count }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
