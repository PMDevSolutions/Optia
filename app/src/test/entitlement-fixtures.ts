import { exportJWK, generateKeyPair, SignJWT } from "jose";
import type { EntitlementJwk } from "@/lib/entitlement-keys";

// Signed-token fixtures for entitlement tests: a fresh Ed25519 keypair per
// suite, so no secrets are ever checked in.

export const TEST_KID = "test-kid";

export interface TestSigningKeys {
  privateKey: CryptoKey;
  jwk: EntitlementJwk;
}

export async function createTestKeys(kid: string = TEST_KID): Promise<TestSigningKeys> {
  const { publicKey, privateKey } = await generateKeyPair("EdDSA", {
    crv: "Ed25519",
    extractable: true,
  });
  const exported = await exportJWK(publicKey);
  const jwk: EntitlementJwk = {
    kty: "OKP",
    crv: "Ed25519",
    x: exported.x as string,
    kid,
    alg: "EdDSA",
    use: "sig",
  };
  return { privateKey: privateKey as CryptoKey, jwk };
}

export interface TestClaimOverrides {
  iss?: string;
  aud?: string;
  sub?: string;
  subjectType?: string;
  tier?: string;
  quotaLimit?: number;
  period?: string;
  exp?: number;
  iat?: number;
}

export const TEST_PERIOD = "2026-07";

export async function signTestToken(
  keys: TestSigningKeys,
  overrides: TestClaimOverrides = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: "optia-backend",
    aud: "optia-extension",
    sub: "lic_test_123",
    subjectType: "license",
    tier: "pro",
    quotaLimit: 100,
    period: TEST_PERIOD,
    iat: now,
    exp: now + 3600,
    ...overrides,
  };
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "EdDSA", kid: keys.jwk.kid })
    .sign(keys.privateKey);
}

/** Corrupts the payload segment while keeping the JWS structurally valid. */
export function tamperWithToken(token: string): string {
  const [header, payload, signature] = token.split(".");
  const flipped = payload[0] === "A" ? "B" : "A";
  return `${header}.${flipped}${payload.slice(1)}.${signature}`;
}

function base64url(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** An unsigned token claiming alg "none" — must never verify. */
export function unsignedToken(kid: string = TEST_KID): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "none", kid }));
  const payload = base64url(
    JSON.stringify({
      iss: "optia-backend",
      aud: "optia-extension",
      sub: "lic_test_123",
      subjectType: "license",
      tier: "pro",
      quotaLimit: 100,
      period: TEST_PERIOD,
      iat: now,
      exp: now + 3600,
    }),
  );
  return `${header}.${payload}.`;
}

/** An HS256-signed token reusing the trusted kid — alg confusion must fail. */
export async function hs256Token(kid: string = TEST_KID): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    iss: "optia-backend",
    aud: "optia-extension",
    sub: "lic_test_123",
    subjectType: "license",
    tier: "pro",
    quotaLimit: 100,
    period: TEST_PERIOD,
    iat: now,
    exp: now + 3600,
  })
    .setProtectedHeader({ alg: "HS256", kid })
    .sign(new TextEncoder().encode("not-a-real-secret-not-a-real-secret"));
}
