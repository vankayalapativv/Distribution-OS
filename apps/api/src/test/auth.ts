import { generateKeyPairSync, sign } from "node:crypto";

// Neon Managed Better Auth issues EdDSA (Ed25519) tokens; mirror that in tests.
const { privateKey, publicKey } = generateKeyPairSync("ed25519");

const keyId = "test-key-1";

function base64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/** Spread into a test env so the auth middleware runs its Neon (EdDSA) path. */
export const authTestEnv = {
  NEON_JWKS_URL: "https://auth.example.test/.well-known/jwks.json",
};

/** The JWKS body the middleware fetches from NEON_JWKS_URL (mock the fetch with this). */
export function installAuthFetchMock() {
  const jwk = publicKey.export({ format: "jwk" }); // { kty:"OKP", crv:"Ed25519", x }
  return { keys: [{ ...jwk, alg: "EdDSA", kid: keyId, use: "sig" }] };
}

/** Mint a Neon-style EdDSA access token for `subject` (= users.app_login_id). */
export function createAuthToken({
  email = "asha@example.test",
  subject,
}: {
  email?: string;
  isAdmin?: boolean; // accepted for call-site compatibility; Neon tokens carry no role
  subject: string;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "EdDSA", kid: keyId, typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({ sub: subject, email, iat: now, exp: now + 60 * 10 }),
  );
  const signingInput = `${header}.${payload}`;
  const signature = sign(null, Buffer.from(signingInput), privateKey); // Ed25519 → null digest
  return `${signingInput}.${base64Url(signature)}`;
}

export function authHeaders(subject: string, init?: { isAdmin?: boolean }) {
  return {
    Authorization: `Bearer ${createAuthToken({ isAdmin: init?.isAdmin, subject })}`,
  };
}
