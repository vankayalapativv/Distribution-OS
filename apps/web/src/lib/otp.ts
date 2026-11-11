import "server-only";

/**
 * Stateless signup email-OTP, stored only in a signed httpOnly cookie on the
 * signup browser. Verify-before-create: no account, password or code is kept
 * server-side — the server holds only the HMAC secret. The cookie carries the
 * code as an HMAC hash (never the code itself), plus the email it was issued
 * for, an expiry, an attempt counter, and its issued-at (for resend cooldown).
 * The whole payload is HMAC-signed so the browser can't tamper with it.
 */
export const OTP_COOKIE = "sa_signup_otp";
export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 30 * 1000; // 30s between sends

interface OtpPayload {
  e: string; // email (lowercased)
  h: string; // HMAC(code)
  x: number; // expires at (ms epoch)
  a: number; // attempts used
  i: number; // issued at (ms epoch)
}

function secret(): string {
  const s = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!s) throw new Error("NEON_AUTH_COOKIE_SECRET is required to sign the OTP cookie.");
  return s;
}

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacHex(message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return b64url(new Uint8Array(sig));
}

/** Constant-time string compare. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Random 6-digit code (crypto RNG), zero-padded. */
export function generateCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, "0");
}

async function encode(payload: OtpPayload): Promise<string> {
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await hmacHex(`sig:${body}`);
  return `${body}.${sig}`;
}

async function decode(cookie: string): Promise<OtpPayload | null> {
  const dot = cookie.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = cookie.slice(0, dot);
  const sig = cookie.slice(dot + 1);
  const expected = await hmacHex(`sig:${body}`);
  if (!safeEqual(sig, expected)) return null;
  try {
    const p = JSON.parse(new TextDecoder().decode(b64urlToBytes(body))) as OtpPayload;
    if (typeof p.e !== "string" || typeof p.h !== "string" || typeof p.x !== "number") return null;
    return p;
  } catch {
    return null;
  }
}

/** Build a fresh OTP cookie value for `email` carrying a hash of `code`. */
export async function issueOtpCookie(email: string, code: string): Promise<string> {
  const now = Date.now();
  const payload: OtpPayload = {
    e: normalizeEmail(email),
    h: await hmacHex(`code:${normalizeEmail(email)}:${code}`),
    x: now + OTP_TTL_MS,
    a: 0,
    i: now,
  };
  return encode(payload);
}

/** How long until another code may be sent, in ms (0 = allowed now). */
export async function resendCooldownRemaining(cookie: string | undefined, email: string): Promise<number> {
  if (!cookie) return 0;
  const p = await decode(cookie);
  if (!p || p.e !== normalizeEmail(email)) return 0;
  const elapsed = Date.now() - p.i;
  return elapsed >= OTP_RESEND_COOLDOWN_MS ? 0 : OTP_RESEND_COOLDOWN_MS - elapsed;
}

export type OtpVerifyResult =
  | { ok: true }
  | { ok: false; reason: "missing" | "expired" | "email_mismatch" | "too_many" | "mismatch"; cookie?: string };

/**
 * Verify a submitted code against the cookie. On a wrong-but-still-allowed code
 * it returns a new `cookie` with the attempt counter bumped — the caller must
 * re-set it so the attempt is remembered.
 */
export async function verifyOtp(
  cookie: string | undefined,
  email: string,
  code: string,
): Promise<OtpVerifyResult> {
  if (!cookie) return { ok: false, reason: "missing" };
  const p = await decode(cookie);
  if (!p) return { ok: false, reason: "missing" };
  if (p.e !== normalizeEmail(email)) return { ok: false, reason: "email_mismatch" };
  if (Date.now() > p.x) return { ok: false, reason: "expired" };
  if (p.a >= OTP_MAX_ATTEMPTS) return { ok: false, reason: "too_many" };

  const h = await hmacHex(`code:${normalizeEmail(email)}:${code}`);
  if (safeEqual(h, p.h)) return { ok: true };

  const bumped = await encode({ ...p, a: p.a + 1 });
  return { ok: false, reason: "mismatch", cookie: bumped };
}
