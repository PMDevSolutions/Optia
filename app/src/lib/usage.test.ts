import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ANALYSIS_COUNTS_KEY,
  SHARE_USAGE_KEY,
  USAGE_REPORT_KEY,
  getMonthlyAnalysisCount,
  isUsageSharingEnabled,
  recordAnalysis,
  reportUsageIfDue,
  setUsageSharingEnabled,
} from "@/lib/usage";
import { BACKEND_BASE_URL } from "@/lib/entitlement-keys";
import { getInstallId } from "@/lib/entitlement";
import { getStorageItem, setStorageItem } from "@/lib/storage";

// Keep the real period helper; only the install id is stubbed.
vi.mock("@/lib/entitlement", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/entitlement")>();
  return { ...original, getInstallId: vi.fn() };
});

const getInstallIdMock = vi.mocked(getInstallId);

const REPORT_URL = `${BACKEND_BASE_URL}/usage/analysis`;
const HOUR = 3_600_000;

const OCT_15 = new Date("2026-10-15T09:00:00Z");

function at(base: Date, hoursLater: number): Date {
  return new Date(base.getTime() + hoursLater * HOUR);
}

async function recordTimes(times: number, now: Date): Promise<void> {
  for (let i = 0; i < times; i++) await recordAnalysis(now);
}

function stubFetch(impl: () => Promise<Response>) {
  const fetchMock = vi.fn<typeof fetch>(impl);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const accepted = () => Promise.resolve(new Response(null, { status: 204 }));
const offline = () => Promise.reject(new TypeError("Failed to fetch"));

function sentBody(fetchMock: ReturnType<typeof stubFetch>, call = 0): unknown {
  return JSON.parse(fetchMock.mock.calls[call][1]?.body as string);
}

beforeEach(() => {
  getInstallIdMock.mockResolvedValue("install-123");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("recordAnalysis", () => {
  it("adds exactly one to this month's count per completed analysis", async () => {
    await recordAnalysis(OCT_15);
    expect(await getMonthlyAnalysisCount(OCT_15)).toBe(1);

    await recordTimes(2, OCT_15);
    expect(await getMonthlyAnalysisCount(OCT_15)).toBe(3);
  });

  it("does not lose an increment when analyses finish together", async () => {
    await Promise.all([1, 2, 3, 4, 5].map(() => recordAnalysis(OCT_15)));

    expect(await getMonthlyAnalysisCount(OCT_15)).toBe(5);
  });

  it("rolls over at the month boundary and keeps only the previous month", async () => {
    await recordTimes(2, new Date("2026-10-31T23:59:59Z"));
    await recordAnalysis(new Date("2026-11-01T00:00:01Z"));

    expect(await getMonthlyAnalysisCount(new Date("2026-11-01T00:00:01Z"))).toBe(1);
    expect(await getStorageItem(ANALYSIS_COUNTS_KEY)).toEqual({ "2026-10": 2, "2026-11": 1 });

    await recordAnalysis(new Date("2026-12-02T10:00:00Z"));
    expect(await getStorageItem(ANALYSIS_COUNTS_KEY)).toEqual({ "2026-11": 1, "2026-12": 1 });
  });

  it("counts by UTC month, the backend's accounting period", async () => {
    // 2026-12-01T03:00Z is still November 30 in the Americas.
    await recordAnalysis(new Date("2026-12-01T03:00:00Z"));

    expect(await getStorageItem(ANALYSIS_COUNTS_KEY)).toEqual({ "2026-12": 1 });
  });

  it("starts each month at zero", async () => {
    await recordTimes(4, OCT_15);

    expect(await getMonthlyAnalysisCount(new Date("2026-11-03T12:00:00Z"))).toBe(0);
  });
});

describe("usage sharing setting", () => {
  it("is on until the user turns it off", async () => {
    expect(await isUsageSharingEnabled()).toBe(true);

    await setUsageSharingEnabled(false);
    expect(await isUsageSharingEnabled()).toBe(false);
    expect(await getStorageItem(SHARE_USAGE_KEY)).toBe(false);

    await setUsageSharingEnabled(true);
    expect(await isUsageSharingEnabled()).toBe(true);
  });
});

describe("reportUsageIfDue", () => {
  it("sends the install id, the month and the running total, and nothing else", async () => {
    const fetchMock = stubFetch(accepted);
    await recordTimes(3, OCT_15);

    await reportUsageIfDue(OCT_15);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(REPORT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ installId: "install-123", period: "2026-10", count: 3 }),
    });
  });

  it("reports at most once a day", async () => {
    const fetchMock = stubFetch(accepted);
    await recordTimes(2, OCT_15);
    await reportUsageIfDue(OCT_15);

    await recordAnalysis(at(OCT_15, 1));
    await reportUsageIfDue(at(OCT_15, 1));
    await reportUsageIfDue(at(OCT_15, 23.9));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await reportUsageIfDue(at(OCT_15, 24));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentBody(fetchMock, 1)).toEqual({ installId: "install-123", period: "2026-10", count: 3 });
  });

  it("survives being offline: the next day's report sends the running total", async () => {
    const fetchMock = stubFetch(offline);
    await recordTimes(2, OCT_15);

    await reportUsageIfDue(OCT_15);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await getStorageItem(USAGE_REPORT_KEY)).toEqual({
      lastAttemptAt: OCT_15.getTime(),
      sent: {},
    });

    // Still the same day: no retry, even after another analysis.
    await recordAnalysis(at(OCT_15, 3));
    await reportUsageIfDue(at(OCT_15, 3));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockImplementation(accepted);
    await reportUsageIfDue(at(OCT_15, 25));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentBody(fetchMock, 1)).toEqual({ installId: "install-123", period: "2026-10", count: 3 });
    expect(await getStorageItem(USAGE_REPORT_KEY)).toEqual({
      lastAttemptAt: at(OCT_15, 25).getTime(),
      sent: { "2026-10": 3 },
    });
  });

  it("treats an error status like offline and tries again the next day", async () => {
    const fetchMock = stubFetch(() => Promise.resolve(new Response("not found", { status: 404 })));
    await recordAnalysis(OCT_15);

    await reportUsageIfDue(OCT_15);
    expect(await getStorageItem(USAGE_REPORT_KEY)).toEqual({
      lastAttemptAt: OCT_15.getTime(),
      sent: {},
    });

    fetchMock.mockImplementation(accepted);
    await reportUsageIfDue(at(OCT_15, 24));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentBody(fetchMock, 1)).toMatchObject({ period: "2026-10", count: 1 });
  });

  it("never sends while sharing is off, but keeps counting", async () => {
    const fetchMock = stubFetch(accepted);
    await setUsageSharingEnabled(false);
    await recordTimes(2, OCT_15);

    await reportUsageIfDue(OCT_15);
    await reportUsageIfDue(at(OCT_15, 48));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await getStorageItem(USAGE_REPORT_KEY)).toBeNull();
    expect(await getMonthlyAnalysisCount(OCT_15)).toBe(2);
  });

  it("sends the running total once sharing is turned back on", async () => {
    const fetchMock = stubFetch(accepted);
    await setUsageSharingEnabled(false);
    await recordTimes(2, OCT_15);
    await reportUsageIfDue(OCT_15);

    await setUsageSharingEnabled(true);
    await reportUsageIfDue(at(OCT_15, 1));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentBody(fetchMock)).toMatchObject({ count: 2 });
  });

  it("sends nothing, and keeps the day open, when there is nothing new to report", async () => {
    const fetchMock = stubFetch(accepted);

    await reportUsageIfDue(OCT_15);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await getStorageItem(USAGE_REPORT_KEY)).toBeNull();

    await recordAnalysis(at(OCT_15, 1));
    await reportUsageIfDue(at(OCT_15, 1));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // A day later with no new analyses: the backend already has this total.
    await reportUsageIfDue(at(OCT_15, 30));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends the previous month's final total alongside the new month's", async () => {
    const fetchMock = stubFetch(accepted);
    const oct31Morning = new Date("2026-10-31T08:00:00Z");
    await recordAnalysis(oct31Morning);
    await reportUsageIfDue(oct31Morning);

    // More analyses after that day's report, then the month turns.
    await recordTimes(2, new Date("2026-10-31T20:00:00Z"));
    const nov1 = new Date("2026-11-01T09:00:00Z");
    await recordAnalysis(nov1);
    await reportUsageIfDue(nov1);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sentBody(fetchMock, 1)).toEqual({ installId: "install-123", period: "2026-10", count: 3 });
    expect(sentBody(fetchMock, 2)).toEqual({ installId: "install-123", period: "2026-11", count: 1 });
    expect(await getStorageItem(USAGE_REPORT_KEY)).toEqual({
      lastAttemptAt: nov1.getTime(),
      sent: { "2026-10": 3, "2026-11": 1 },
    });
  });

  it("caps the count at the backend's 10,000 limit", async () => {
    const fetchMock = stubFetch(accepted);
    await setStorageItem(ANALYSIS_COUNTS_KEY, { "2026-10": 12_345 });

    await reportUsageIfDue(OCT_15);

    expect(sentBody(fetchMock)).toMatchObject({ count: 10_000 });
  });

  it("shares one report between overlapping calls", async () => {
    const fetchMock = stubFetch(accepted);
    await recordAnalysis(OCT_15);

    await Promise.all([reportUsageIfDue(OCT_15), reportUsageIfDue(OCT_15)]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("treats a clock that moved backwards as due instead of stalling", async () => {
    const fetchMock = stubFetch(accepted);
    await setStorageItem(USAGE_REPORT_KEY, { lastAttemptAt: at(OCT_15, 72).getTime(), sent: {} });
    await recordAnalysis(OCT_15);

    await reportUsageIfDue(OCT_15);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never throws, even when the install id cannot be read", async () => {
    const fetchMock = stubFetch(accepted);
    getInstallIdMock.mockRejectedValue(new Error("storage unavailable"));
    await recordAnalysis(OCT_15);

    await expect(reportUsageIfDue(OCT_15)).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
