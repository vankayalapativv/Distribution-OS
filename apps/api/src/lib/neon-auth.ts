import { ApiError } from "./errors";

/**
 * Verify a Neon Managed Better Auth access token.
 *
 * Neon issues EdDSA (Ed25519) JWTs and publishes the public keys at the
 * project's JWKS endpoint (`NEON_JWKS_URL`). We verify the signature with the
 * Workers-native Web Crypto Ed25519 primitive — no `jose`/Node crypto needed.
 *
 * Better Auth tokens carry only default claims (`sub`, `email`, `exp`, …) — no
 * app role — so the caller maps `subject` → our `users.app_login_id` to resolve
 * the application role. `email` is best-effort (used for display only).
 */

type OkpJwk = {
  kty?: string;
  crv?: string;
  x?: string;
  kid?: string;
  alg?: string;
};

type JsonWebKeySet = { keys?: OkpJwk[] };

interface JwtHeader {
  alg?: string;
  kid?: string;
  typ?: string;
}

interface JwtPayload {
  sub?: string;
  email?: string;
  exp?: number;
  nbf?: number;
}

export interface VerifiedNeonToken {
  subject: string;
  email: string | null;
}

// Per-isolate JWKS cache (keyed by URL). Neon rotates rarely; a fresh isolate
// re-fetches, and an unknown `kid` forces a refetch below.
const jwksCache = new Map<string, JsonWebKeySet>();

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJson<T>(value: string): T {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as T;
}

/** Uint8Array → a plain ArrayBuffer (Web Crypto's BufferSource is picky in TS). */
function bufferSource(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function fetchJwks(jwksUrl: string): Promise<JsonWebKeySet> {
  const res = await fetch(jwksUrl);
  if (!res.ok) throw new ApiError("AUTH_JWKS_UNAVAILABLE", "Auth JWKS is unavailable.", 401);
  const jwks = (await res.json()) as JsonWebKeySet;
  jwksCache.set(jwksUrl, jwks);
  return jwks;
}

async function findKey(jwksUrl: string, kid: string | undefined): Promise<OkpJwk> {
  // Pin to Ed25519 OKP keys: importKey hard-codes Ed25519, so a non-Ed25519 OKP
  // key from the JWKS would be force-interpreted. With no `kid`, this also avoids
  // picking an unrelated curve's first OKP key.
  const pick = (jwks: JsonWebKeySet): OkpJwk | undefined =>
    (jwks.keys ?? []).find(
      (k) => k.kty === "OKP" && k.crv === "Ed25519" && (kid ? k.kid === kid : true),
    );

  const cached = jwksCache.get(jwksUrl);
  const fromCache = cached && pick(cached);
  if (fromCache) return fromCache;

  const fresh = pick(await fetchJwks(jwksUrl));
  if (!fresh) throw new ApiError("INVALID_AUTH_TOKEN", "Auth token key was not found.", 401);
  return fresh;
}

export async function verifyNeonToken(token: string, jwksUrl: string): Promise<VerifiedNeonToken> {
  const [encHeader, encPayload, encSig] = token.split(".");
  if (!encHeader || !encPayload || !encSig) {
    throw new ApiError("INVALID_AUTH_TOKEN", "Auth token is malformed.", 401);
  }

  const header = decodeJson<JwtHeader>(encHeader);
  if (header.alg !== "EdDSA") {
    throw new ApiError("INVALID_AUTH_TOKEN", "Auth token uses an unsupported algorithm.", 401);
  }

  const jwk = await findKey(jwksUrl, header.kid);
  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "OKP", crv: "Ed25519", x: jwk.x },
    { name: "Ed25519" },
    false,
    ["verify"],
  );

  const signingInput = new TextEncoder().encode(`${encHeader}.${encPayload}`);
  const signature = decodeBase64Url(encSig);
  const valid = await crypto.subtle.verify(
    { name: "Ed25519" },
    key,
    bufferSource(signature),
    bufferSource(signingInput),
  );
  if (!valid) throw new ApiError("INVALID_AUTH_TOKEN", "Auth token signature is invalid.", 401);

  const payload = decodeJson<JwtPayload>(encPayload);
  const now = Math.floor(Date.now() / 1000);

  if (!payload.sub) {
    throw new ApiError("INVALID_AUTH_TOKEN", "Auth token identity is incomplete.", 401);
  }
  if (typeof payload.exp !== "number" || payload.exp <= now) {
    throw new ApiError("INVALID_AUTH_TOKEN", "Auth token has expired.", 401);
  }
  if (typeof payload.nbf === "number" && payload.nbf > now) {
    throw new ApiError("INVALID_AUTH_TOKEN", "Auth token is not active yet.", 401);
  }

  return { subject: payload.sub, email: payload.email ?? null };
}
