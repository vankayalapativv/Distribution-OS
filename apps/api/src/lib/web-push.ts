/**
 * Web Push (browser) sending for Cloudflare Workers — pure Web Crypto, no Node.
 * Implements VAPID (RFC 8292) request auth + aes128gcm message encryption
 * (RFC 8291 / RFC 8188). The Node `web-push` package is Node-crypto-only and
 * won't run on Workers, so this is a from-scratch implementation, verified
 * against the RFC 8291 Appendix A test vector (see web-push.test.ts).
 */

// ---- base64url ----

export function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

const utf8 = (s: string) => new TextEncoder().encode(s);

// ---- HKDF (SHA-256) via Web Crypto ----

async function hkdf(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  lengthBytes: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm as BufferSource, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: info as BufferSource },
    key,
    lengthBytes * 8,
  );
  return new Uint8Array(bits);
}

// ---- ECDH key helpers ----

/** Import a P-256 public key from its raw 65-byte uncompressed point. */
function importEcdhPublic(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw as BufferSource, { name: "ECDH", namedCurve: "P-256" }, false, []);
}

/** Rebuild a P-256 private CryptoKey from raw scalar (d) + raw public point. */
function importEcdhPrivate(scalar: Uint8Array, publicPoint: Uint8Array, usages: KeyUsage[], name: "ECDH" | "ECDSA"): Promise<CryptoKey> {
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    d: b64urlEncode(scalar),
    x: b64urlEncode(publicPoint.slice(1, 33)),
    y: b64urlEncode(publicPoint.slice(33, 65)),
    ext: true,
  };
  return crypto.subtle.importKey("jwk", jwk, { name, namedCurve: "P-256" }, false, usages);
}

// ---- RFC 8291 payload encryption (aes128gcm) ----

export interface EncryptOverrides {
  /** Ephemeral application-server key pair (raw scalar + raw point) — TEST ONLY. */
  asPrivate?: Uint8Array;
  asPublic?: Uint8Array;
  /** 16-byte salt — TEST ONLY (production is random). */
  salt?: Uint8Array;
}

/**
 * Encrypt `plaintext` for a subscription's `uaPublic` (p256dh) + `authSecret`
 * (auth). Returns the full aes128gcm body: salt || rs(4) || idlen(1) ||
 * as_public(65) || ciphertext. Overrides let the test pin the ephemeral key +
 * salt to reproduce the RFC vector.
 */
export async function encryptPayload(
  plaintext: Uint8Array,
  uaPublic: Uint8Array,
  authSecret: Uint8Array,
  overrides: EncryptOverrides = {},
): Promise<Uint8Array> {
  const salt = overrides.salt ?? crypto.getRandomValues(new Uint8Array(16));

  let asPublic: Uint8Array;
  let asPrivateKey: CryptoKey;
  if (overrides.asPrivate && overrides.asPublic) {
    asPublic = overrides.asPublic;
    asPrivateKey = await importEcdhPrivate(overrides.asPrivate, overrides.asPublic, ["deriveBits"], "ECDH");
  } else {
    const pair = (await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"],
    )) as CryptoKeyPair;
    asPrivateKey = pair.privateKey;
    asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  }

  const uaKey = await importEcdhPublic(uaPublic);
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asPrivateKey, 256),
  );

  // Combine ECDH + auth secret (RFC 8291 §3.4).
  const keyInfo = concat(utf8("WebPush: info"), new Uint8Array([0]), uaPublic, asPublic);
  const ikm = await hkdf(ecdhSecret, authSecret, keyInfo, 32);

  // RFC 8188 content key + nonce, salted with the message salt.
  const cek = await hkdf(ikm, salt, concat(utf8("Content-Encoding: aes128gcm"), new Uint8Array([0])), 16);
  const nonce = await hkdf(ikm, salt, concat(utf8("Content-Encoding: nonce"), new Uint8Array([0])), 12);

  // Single record: plaintext followed by the 0x02 last-record padding delimiter.
  const record = concat(plaintext, new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey("raw", cek as BufferSource, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as BufferSource }, aesKey, record as BufferSource),
  );

  const rs = new Uint8Array([0, 0, 0x10, 0]); // record size 4096, big-endian uint32
  const header = concat(salt, rs, new Uint8Array([asPublic.length]), asPublic);
  return concat(header, ciphertext);
}

// ---- RFC 8292 VAPID JWT ----

export interface VapidKeys {
  /** base64url raw uncompressed public point (65 bytes). */
  publicKey: string;
  /** base64url raw private scalar (32 bytes). */
  privateKey: string;
  /** Contact URI, e.g. "mailto:ops@example.com". */
  subject: string;
}

/** Build + sign the VAPID JWT for a push endpoint's origin (`audience`). */
export async function vapidJwt(audience: string, vapid: VapidKeys, nowSec: number): Promise<string> {
  const header = b64urlEncode(utf8(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = b64urlEncode(
    utf8(JSON.stringify({ aud: audience, exp: nowSec + 12 * 60 * 60, sub: vapid.subject })),
  );
  const signingInput = `${header}.${payload}`;
  const key = await importEcdhPrivate(
    b64urlDecode(vapid.privateKey),
    b64urlDecode(vapid.publicKey),
    ["sign"],
    "ECDSA",
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, utf8(signingInput) as BufferSource),
  );
  return `${signingInput}.${b64urlEncode(sig)}`;
}

// ---- send ----

export interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Encrypt + POST one push message. Returns the raw Response so the caller can
 * prune stale subscriptions on 404/410. `nowSec` is injected (Workers/Date).
 */
export async function sendWebPush(
  subscription: PushSubscription,
  payload: unknown,
  vapid: VapidKeys,
  nowSec: number,
): Promise<Response> {
  const body = await encryptPayload(
    utf8(JSON.stringify(payload)),
    b64urlDecode(subscription.p256dh),
    b64urlDecode(subscription.auth),
  );
  const audience = new URL(subscription.endpoint).origin;
  const jwt = await vapidJwt(audience, vapid, nowSec);
  return fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "2419200",
      Authorization: `vapid t=${jwt},k=${vapid.publicKey}`,
    },
    body: body as BodyInit,
  });
}
