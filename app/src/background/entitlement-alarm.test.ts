import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { EntitlementClaims } from "@/lib/entitlement";

// Mock the entitlement lib entirely (constants included) so this suite drives
// the scheduling logic without touching jose or storage.
vi.mock("@/lib/entitlement", () => ({
  ENTITLEMENT_TOKEN_KEY: "entitlement_token",
  LICENSE_KEY_KEY: "license_key",
  refreshNow: vi.fn(),
  getValidEntitlement: vi.fn(),
  hasStoredLicenseKey: vi.fn(),
  getRefreshFailureCount: vi.fn(),
}));

import {
  getRefreshFailureCount,
  getValidEntitlement,
  hasStoredLicenseKey,
  refreshNow,
} from "@/lib/entitlement";
import { registerEntitlementAlarms, ensureScheduled, ENTITLEMENT_ALARM } from "./entitlement-alarm";

const refreshNowMock = vi.mocked(refreshNow);
const getValidEntitlementMock = vi.mocked(getValidEntitlement);
const hasStoredLicenseKeyMock = vi.mocked(hasStoredLicenseKey);
const getRefreshFailureCountMock = vi.mocked(getRefreshFailureCount);

const NOW = 1_800_000_000_000; // fixed ms epoch
const HOUR = 3_600_000;

function claimsFor(lifetimeHours: number, elapsedHours = 0): EntitlementClaims {
  const iat = Math.floor((NOW - elapsedHours * HOUR) / 1000);
  return {
    sub: "lic_1",
    subjectType: "license",
    tier: "pro",
    quotaLimit: 100,
    period: "2026-07",
    iat,
    exp: iat + lifetimeHours * 3600,
  };
}

function alarmCreateMock() {
  return vi.mocked(chrome.alarms.create);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  hasStoredLicenseKeyMock.mockResolvedValue(true);
  getRefreshFailureCountMock.mockResolvedValue(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ensureScheduled", () => {
  it("clears the alarm when no license key is stored", async () => {
    hasStoredLicenseKeyMock.mockResolvedValue(false);

    await ensureScheduled();

    expect(chrome.alarms.clear).toHaveBeenCalledWith(ENTITLEMENT_ALARM);
    expect(chrome.alarms.create).not.toHaveBeenCalled();
  });

  it("arms the alarm at 75% of the token lifetime for a fresh token", async () => {
    getValidEntitlementMock.mockResolvedValue(claimsFor(24));

    await ensureScheduled();

    expect(refreshNowMock).not.toHaveBeenCalled();
    const [name, info] = alarmCreateMock().mock.calls[0];
    expect(name).toBe(ENTITLEMENT_ALARM);
    expect(info?.when).toBe(NOW + 18 * HOUR); // 75% of 24h
  });

  it("never schedules later than 1h before expiry", async () => {
    // 2h lifetime: 75% = +1.5h but exp−1h = +1h wins
    getValidEntitlementMock.mockResolvedValue(claimsFor(2));

    await ensureScheduled();

    expect(alarmCreateMock().mock.calls[0][1]?.when).toBe(NOW + 1 * HOUR);
  });

  it("refreshes immediately when the token is past its refresh point", async () => {
    const claims = claimsFor(24, 20); // 20h into a 24h token
    getValidEntitlementMock.mockResolvedValue(claims);
    refreshNowMock.mockResolvedValue(claimsFor(24));

    await ensureScheduled();

    expect(refreshNowMock).toHaveBeenCalled();
    expect(alarmCreateMock().mock.calls[0][1]?.when).toBe(NOW + 18 * HOUR);
  });

  it("refreshes immediately when there is a license key but no valid token", async () => {
    getValidEntitlementMock.mockResolvedValue(null);
    refreshNowMock.mockResolvedValue(claimsFor(24));

    await ensureScheduled();

    expect(refreshNowMock).toHaveBeenCalled();
    expect(chrome.alarms.create).toHaveBeenCalled();
  });
});

describe("refresh failure handling", () => {
  it("backs off exponentially while keeping the cached token", async () => {
    getValidEntitlementMock.mockResolvedValue(null);
    refreshNowMock.mockResolvedValue(claimsFor(24)); // cached fallback claims
    getRefreshFailureCountMock.mockResolvedValue(3);

    await ensureScheduled();

    // 5 · 2^(3−1) = 20 minutes
    expect(alarmCreateMock().mock.calls[0][1]?.when).toBe(NOW + 20 * 60_000);
  });

  it("caps the backoff at 6 hours", async () => {
    getValidEntitlementMock.mockResolvedValue(null);
    refreshNowMock.mockResolvedValue(null);
    getRefreshFailureCountMock.mockResolvedValue(12);

    await ensureScheduled();

    expect(alarmCreateMock().mock.calls[0][1]?.when).toBe(NOW + 6 * HOUR);
  });

  it("retries no later than 5min before a still-valid token expires", async () => {
    getValidEntitlementMock.mockResolvedValue(null);
    refreshNowMock.mockResolvedValue(claimsFor(24, 23.9)); // ~6min left
    getRefreshFailureCountMock.mockResolvedValue(4); // would be 40min

    await ensureScheduled();

    const when = alarmCreateMock().mock.calls[0][1]?.when as number;
    expect(when).toBe(NOW + 60_000); // clamped to the 1min floor
  });

  it("clears the alarm after a revoked license wiped local state", async () => {
    getValidEntitlementMock.mockResolvedValue(null);
    refreshNowMock.mockImplementation(async () => {
      hasStoredLicenseKeyMock.mockResolvedValue(false); // refreshNow cleared state
      return null;
    });

    await ensureScheduled();

    expect(chrome.alarms.clear).toHaveBeenCalledWith(ENTITLEMENT_ALARM);
    expect(chrome.alarms.create).not.toHaveBeenCalled();
  });
});

describe("registerEntitlementAlarms", () => {
  it("registers alarm, lifecycle, and storage listeners", () => {
    registerEntitlementAlarms();

    expect(chrome.alarms.onAlarm.addListener).toHaveBeenCalledTimes(1);
    expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalledTimes(1);
    expect(chrome.runtime.onStartup.addListener).toHaveBeenCalledTimes(1);
    expect(chrome.storage.onChanged.addListener).toHaveBeenCalledTimes(1);
  });

  it("refreshes and re-arms when the alarm fires", async () => {
    registerEntitlementAlarms();
    refreshNowMock.mockResolvedValue(claimsFor(24));

    const onAlarm = vi.mocked(chrome.alarms.onAlarm.addListener).mock.calls[0][0];
    onAlarm({ name: ENTITLEMENT_ALARM, scheduledTime: NOW, periodInMinutes: undefined });
    await vi.waitFor(() => expect(chrome.alarms.create).toHaveBeenCalled());

    expect(alarmCreateMock().mock.calls[0][1]?.when).toBe(NOW + 18 * HOUR);
  });

  it("ignores other alarms", async () => {
    registerEntitlementAlarms();
    const onAlarm = vi.mocked(chrome.alarms.onAlarm.addListener).mock.calls[0][0];

    onAlarm({ name: "other-alarm", scheduledTime: NOW, periodInMinutes: undefined });
    await Promise.resolve();

    expect(refreshNowMock).not.toHaveBeenCalled();
  });

  it("re-arms via storage change when a token is written elsewhere", async () => {
    registerEntitlementAlarms();
    getValidEntitlementMock.mockResolvedValue(claimsFor(24));

    const onChanged = vi.mocked(chrome.storage.onChanged.addListener).mock.calls[0][0];
    onChanged({ entitlement_token: { newValue: "t" } }, "local");
    await vi.waitFor(() => expect(chrome.alarms.create).toHaveBeenCalled());

    onChanged({ unrelated: { newValue: 1 } }, "local");
    onChanged({ entitlement_token: { newValue: "t" } }, "session");
    expect(getValidEntitlementMock).toHaveBeenCalledTimes(1);
  });
});
