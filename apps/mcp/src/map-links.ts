/**
 * Signed, short-lived links for the interactive `/m/<id>` map page. A map can
 * carry real distribution data, so the id alone isn't enough to view it: the URL
 * also needs `?t=<token>`, an HMAC over `id.exp` that expires. No login needed
 * (works from any chat), but the link dies after its TTL.
 */
const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer): string {
  const b = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(b).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

/** A random, unguessable map id. */
export function newMapId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/** Build the `t` token for `id`, valid until `exp` (epoch ms). */
export async function signToken(id: string, exp: number, secret: string): Promise<string> {
  const sig = await hmac(`${id}.${exp}`, secret);
  return `${exp}.${sig}`;
}

/** True when `token` is a valid, unexpired signature for `id`. Constant-time. */
export async function verifyToken(id: string, token: string, secret: string): Promise<boolean> {
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const exp = Number(token.slice(0, dot));
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  const expected = await signToken(id, exp, secret);
  // Constant-time compare of equal-length strings.
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
