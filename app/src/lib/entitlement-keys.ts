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

export const BACKEND_BASE_URL: string = isProduction
  ? "https://api.optia-api.com"
  : "https://optia-backend-staging.paul-130.workers.dev";

// Array to accommodate rotation overlap (multi-entry JWKS) later
export const ENTITLEMENT_JWKS: EntitlementJwk[] = isProduction
  ? [PRODUCTION_JWK]
  : [STAGING_JWK];
