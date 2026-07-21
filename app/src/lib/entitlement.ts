import { decodeProtectedHeader, importJWK, jwtVerify } from "jose";
import {
  activateLicense,
  deactivateLicense,
  refreshEntitlementToken,
  LicenseError,
} from "@/lib/backend";
import { ENTITLEMENT_JWKS, type EntitlementJwk } from "@/lib/entitlement-keys";
import { getStorageItem, removeStorageItem, setStorageItem } from "@/lib/storage";

// Core entitlement layer: verify, cache, refresh, and meter the signed
// entitlement. This module is the ONLY code allowed to touch the storage keys
// below — everything else reads flags from the entitlement store.

export const ENTITLEMENT_TOKEN_KEY = "entitlement_token";
export const LICENSE_KEY_KEY = "license_key";
export const INSTALL_ID_KEY = "install_id";
export const AI_USAGE_KEY = "ai_usage";
export const REFRESH_FAILURES_KEY = "entitlement_refresh_failures";

const ISSUER = "optia-backend";
const AUDIENCE = "optia-extension";
const CLOCK_TOLERANCE_SECONDS = 60;

export interface EntitlementClaims {
  sub: string;
  subjectType: string;
  tier: string; // only "pro" grants Pro; any other value is treated as free
  quotaLimit: number;
  period: string; // e.g. "2026-07" — quota accounting window
  exp: number; // seconds epoch
  iat?: number;
}

export interface VerifyOptions {
  jwks?: EntitlementJwk[];
  now?: Date;
}

interface AiUsageRecord {
  period: string;
  used: number;
}

/**
 * Verifies a raw JWS entitlement and returns its claims, or null for ANY
 * failure (bad signature, wrong alg, unknown kid, expired, malformed claims).
 * Never throws: an unverifiable token always resolves to the free tier.
 */
export async function verifyEntitlementToken(
  token: string,
  options: VerifyOptions = {},
): Promise<EntitlementClaims | null> {
  const jwks = options.jwks ?? ENTITLEMENT_JWKS;
  try {
    const header = decodeProtectedHeader(token);
    if (header.alg !== "EdDSA") return null;
    const jwk = jwks.find((key) => key.kid === header.kid);
    if (!jwk) return null;

    const publicKey = await importJWK({ ...jwk }, "EdDSA");
    const { payload } = await jwtVerify(token, publicKey, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["EdDSA"],
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
      currentDate: options.now,
    });

    if (
      typeof payload.sub !== "string" ||
      typeof payload.subjectType !== "string" ||
      typeof payload.tier !== "string" ||
      typeof payload.quotaLimit !== "number" ||
      typeof payload.period !== "string" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }

    return {
      sub: payload.sub,
      subjectType: payload.subjectType,
      tier: payload.tier,
      quotaLimit: payload.quotaLimit,
      period: payload.period,
      exp: payload.exp,
      iat: typeof payload.iat === "number" ? payload.iat : undefined,
    };
  } catch {
    return null;
  }
}

/** Stable anonymous install id, generated once per profile (seat identity). */
export async function getInstallId(): Promise<string> {
  const existing = await getStorageItem<string>(INSTALL_ID_KEY);
  if (existing) return existing;
  const installId = crypto.randomUUID();
  await setStorageItem(INSTALL_ID_KEY, installId);
  return installId;
}

export async function hasStoredLicenseKey(): Promise<boolean> {
  return (await getStorageItem<string>(LICENSE_KEY_KEY)) !== null;
}

/**
 * The cached entitlement, if it still verifies and has not expired.
 * Missing, expired, or tampered ⇒ null (free tier) — never Pro.
 */
export async function getValidEntitlement(
  options: VerifyOptions = {},
): Promise<EntitlementClaims | null> {
  const token = await getStorageItem<string>(ENTITLEMENT_TOKEN_KEY);
  if (!token) return null;
  return verifyEntitlementToken(token, options);
}

export async function getRefreshFailureCount(): Promise<number> {
  return (await getStorageItem<number>(REFRESH_FAILURES_KEY)) ?? 0;
}

async function clearLocalLicenseState(): Promise<void> {
  await removeStorageItem(ENTITLEMENT_TOKEN_KEY);
  await removeStorageItem(LICENSE_KEY_KEY);
  await removeStorageItem(AI_USAGE_KEY);
  await removeStorageItem(REFRESH_FAILURES_KEY);
}

async function persistVerifiedToken(token: string, licenseKey: string): Promise<void> {
  await setStorageItem(LICENSE_KEY_KEY, licenseKey);
  await setStorageItem(ENTITLEMENT_TOKEN_KEY, token);
  await removeStorageItem(REFRESH_FAILURES_KEY);
}

/**
 * Exchanges a license key for an entitlement and persists both. Throws
 * LicenseError on backend rejection or if the returned token does not verify.
 */
export async function activate(
  licenseKey: string,
  options: VerifyOptions = {},
): Promise<EntitlementClaims> {
  const installId = await getInstallId();
  const token = await activateLicense(licenseKey, installId);
  const claims = await verifyEntitlementToken(token, options);
  if (!claims) {
    throw new LicenseError("server", "The license server returned an invalid entitlement.");
  }
  await persistVerifiedToken(token, licenseKey);
  return claims;
}

/** Releases this install's seat (best effort) and clears all local license state. */
export async function deactivate(): Promise<void> {
  const licenseKey = await getStorageItem<string>(LICENSE_KEY_KEY);
  if (licenseKey) {
    try {
      await deactivateLicense(licenseKey, await getInstallId());
    } catch {
      // Seat release is best-effort; local state is cleared regardless
    }
  }
  await clearLocalLicenseState();
}

/**
 * Refreshes the entitlement using the stored license key.
 * - success: persists the new token (only after it verifies) and returns its claims
 * - revoked/unknown license (403/404): clears all license state, returns null
 * - network/server/rate-limit failure or tampered response: increments the
 *   failure counter and falls back to the last valid, unexpired entitlement
 */
export async function refreshNow(
  options: VerifyOptions = {},
): Promise<EntitlementClaims | null> {
  const licenseKey = await getStorageItem<string>(LICENSE_KEY_KEY);
  if (!licenseKey) return getValidEntitlement(options);

  let token: string;
  try {
    token = await refreshEntitlementToken(licenseKey, await getInstallId());
  } catch (error) {
    if (error instanceof LicenseError && error.code === "invalid") {
      await clearLocalLicenseState();
      return null;
    }
    await setStorageItem(REFRESH_FAILURES_KEY, (await getRefreshFailureCount()) + 1);
    return getValidEntitlement(options);
  }

  const claims = await verifyEntitlementToken(token, options);
  if (!claims) {
    await setStorageItem(REFRESH_FAILURES_KEY, (await getRefreshFailureCount()) + 1);
    return getValidEntitlement(options);
  }
  await persistVerifiedToken(token, licenseKey);
  return claims;
}

/** Remaining AI quota for the given claims' period (own-key calls are not metered). */
export async function getAiQuotaRemaining(claims: EntitlementClaims): Promise<number> {
  const usage = await getStorageItem<AiUsageRecord>(AI_USAGE_KEY);
  const used = usage && usage.period === claims.period ? usage.used : 0;
  return Math.max(0, claims.quotaLimit - used);
}

/**
 * Records one metered AI call against the current period and returns the
 * remaining quota. No valid entitlement ⇒ 0, nothing recorded.
 */
export async function consumeAiQuota(options: VerifyOptions = {}): Promise<number> {
  const claims = await getValidEntitlement(options);
  if (!claims) return 0;
  const usage = await getStorageItem<AiUsageRecord>(AI_USAGE_KEY);
  const used = (usage && usage.period === claims.period ? usage.used : 0) + 1;
  await setStorageItem<AiUsageRecord>(AI_USAGE_KEY, { period: claims.period, used });
  return Math.max(0, claims.quotaLimit - used);
}
