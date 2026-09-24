// Per-environment entitlement verification material, selected at build time via
// Vite mode. Both JWKs are public by design: they can verify entitlements, never
// mint them. Serve-time truth is GET /license/public-key on each environment;
// tokens carry the signing key's kid, so an unknown kid signals rotation.

export interface EntitlementJwk {
  kty: "OKP";
  crv: "Ed25519";
  x: string;
  kid: string;
  alg: "EdDSA";
  use: "sig";
}

const STAGING_JWK: EntitlementJwk = {
  kty: "OKP",
  crv: "Ed25519",
  x: "AWX8-FTOTsDK1rlPyM3Vyt8zZaQy9PvxvRyY_Zy_Nf8",
  kid: "StBSVL1UePNJz7heY9--BuCARHrdD-afRHhUicmwWtM",
  alg: "EdDSA",
  use: "sig",
};

const PRODUCTION_JWK: EntitlementJwk = {
  kty: "OKP",
  crv: "Ed25519",
  x: "j8NLndJEEDGvDISm9ZEXLlcJyS_ULzw_iUkKMQrYjfg",
  kid: "7nwkI8jgmbJnMjWEZXnEIdd53-DlDXdARJxVhTOmDnQ",
  alg: "EdDSA",
  use: "sig",
};

const isProduction = import.meta.env.MODE === "production";

const PRODUCTION_BACKEND_URL = "https://api.optia-api.com";
const STAGING_BACKEND_URL = "https://optia-backend-staging.paul-130.workers.dev";

/** Mount path of the vite dev server's backend proxy (see vite.config.dev.ts). */
export const DEV_BACKEND_PROXY_PATH = "/api/backend";

/**
 * Picks the backend origin for a build. Production builds use the production
 * API and everything else uses staging, with one exception: the dev preview
 * harness (dev.html served by vite over http://localhost) cannot call staging
 * directly, because staging's CORS allowlist admits only the extension origin
 * and the staging site (#67). The harness talks to staging through the dev
 * server's /api/backend proxy instead, the same way BYOK calls go through
 * /api/anthropic. `location` is the page's window.location, or undefined where
 * there is no document (the service worker).
 */
export function resolveBackendBaseUrl(
  mode: string,
  location: Pick<Location, "protocol" | "origin"> | undefined,
): string {
  if (mode === "production") return PRODUCTION_BACKEND_URL;
  // Only the harness is served over http(s) in development; the unpacked dev
  // extension's pages are chrome-extension:// and keep going to staging.
  if (mode === "development" && location && /^https?:$/.test(location.protocol)) {
    return `${location.origin}${DEV_BACKEND_PROXY_PATH}`;
  }
  return STAGING_BACKEND_URL;
}

export const BACKEND_BASE_URL: string = resolveBackendBaseUrl(
  import.meta.env.MODE,
  typeof window === "undefined" ? undefined : window.location,
);

// Array to accommodate rotation overlap (multi-entry JWKS) later
export const ENTITLEMENT_JWKS: EntitlementJwk[] = isProduction
  ? [PRODUCTION_JWK]
  : [STAGING_JWK];
