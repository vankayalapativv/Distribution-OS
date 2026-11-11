import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  generateCode,
  issueOtpCookie,
  normalizeEmail,
  resendCooldownRemaining,
  verifyOtp,
} from "./otp";

beforeAll(() => {
  process.env.NEON_AUTH_COOKIE_SECRET = "test-secret-key-for-otp-signing";
});

afterEach(() => {
  vi.useRealTimers();
});

const EMAIL = "Asha@Company.com";
const CODE = "123456";

describe("generateCode", () => {
  it("is always a 6-digit numeric string", () => {
    for (let i = 0; i < 200; i++) {
      const c = generateCode();
      expect(c).toMatch(/^\d{6}$/);
    }
  });
});

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Asha@Company.com ")).toBe("asha@company.com");
  });
});

describe("verifyOtp", () => {
  it("accepts the correct code (case-insensitive email)", async () => {
    const cookie = await issueOtpCookie(EMAIL, CODE);
    const r = await verifyOtp(cookie, "asha@company.com", CODE);
    expect(r.ok).toBe(true);
  });

  it("rejects a missing cookie", async () => {
    const r = await verifyOtp(undefined, EMAIL, CODE);
    expect(r).toEqual({ ok: false, reason: "missing" });
  });

  it("rejects a tampered cookie as missing (signature fails)", async () => {
    const cookie = await issueOtpCookie(EMAIL, CODE);
    // Flip a character in the payload body (before the dot).
    const dot = cookie.lastIndexOf(".");
    const body = cookie.slice(0, dot);
    const flipped = (body[2] === "A" ? "B" : "A") + body.slice(1); // mutate first char
    const tampered = `${flipped}${cookie.slice(dot)}`;
    const r = await verifyOtp(tampered, EMAIL, CODE);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("missing");
  });

  it("rejects a code sent to a different email", async () => {
    const cookie = await issueOtpCookie(EMAIL, CODE);
    const r = await verifyOtp(cookie, "someone@else.com", CODE);
    expect(r).toMatchObject({ ok: false, reason: "email_mismatch" });
  });

  it("rejects a wrong code and bumps the attempt counter", async () => {
    const cookie = await issueOtpCookie(EMAIL, CODE);
    const r = await verifyOtp(cookie, EMAIL, "000000");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("mismatch");
      expect(r.cookie).toBeTruthy(); // a new cookie with attempts+1
    }
  });

  it("locks out after OTP_MAX_ATTEMPTS wrong tries", async () => {
    let cookie = await issueOtpCookie(EMAIL, CODE);
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) {
      const r = await verifyOtp(cookie, EMAIL, "000000");
      expect(r.ok).toBe(false);
      if (!r.ok && r.cookie) cookie = r.cookie;
    }
    // The next attempt — even with the CORRECT code — is refused.
    const locked = await verifyOtp(cookie, EMAIL, CODE);
    expect(locked).toMatchObject({ ok: false, reason: "too_many" });
  });

  it("rejects an expired code", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const cookie = await issueOtpCookie(EMAIL, CODE);
    vi.setSystemTime(new Date(Date.now() + OTP_TTL_MS + 1000));
    const r = await verifyOtp(cookie, EMAIL, CODE);
    expect(r).toMatchObject({ ok: false, reason: "expired" });
  });
});

describe("resendCooldownRemaining", () => {
  it("is positive right after issue and clears after the window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const cookie = await issueOtpCookie(EMAIL, CODE);
    expect(await resendCooldownRemaining(cookie, EMAIL)).toBeGreaterThan(0);
    vi.setSystemTime(new Date(Date.now() + OTP_RESEND_COOLDOWN_MS + 1));
    expect(await resendCooldownRemaining(cookie, EMAIL)).toBe(0);
  });

  it("is 0 for a missing cookie or a different email", async () => {
    const cookie = await issueOtpCookie(EMAIL, CODE);
    expect(await resendCooldownRemaining(undefined, EMAIL)).toBe(0);
    expect(await resendCooldownRemaining(cookie, "other@x.com")).toBe(0);
  });
});
