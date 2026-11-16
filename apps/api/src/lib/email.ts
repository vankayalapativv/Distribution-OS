/**
 * Transactional email via Resend (Workers-native `fetch`, no SDK). Supports file
 * attachments (base64), used by the GSTR-1 "email to CA" flow and the billing
 * reminders. A no-op that returns false when RESEND_API_KEY is unset, so callers
 * can surface "email isn't configured" without throwing.
 */
import type { ApiEnv } from "../types";

type Env = ApiEnv["Bindings"];

const DEFAULT_FROM = "Distribution OS <noreply@updates.vardhansystems.in>";

/** A Resend attachment: `content` is the file's bytes, base64-encoded. */
export interface EmailAttachment {
  filename: string;
  content: string;
}

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
  /** Overrides the default From (e.g. a product-specific sender). */
  from?: string;
}

/** Send one email. Returns true on a 2xx from Resend, false if unconfigured or
 *  rejected (the caller decides whether that is a 503 / silent no-op). */
export async function sendEmail(env: Env, msg: EmailMessage): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: msg.from ?? env.ALERT_FROM ?? DEFAULT_FROM,
      to: Array.isArray(msg.to) ? msg.to : [msg.to],
      subject: msg.subject,
      html: msg.html,
      ...(msg.attachments && msg.attachments.length > 0 ? { attachments: msg.attachments } : {}),
    }),
  });
  return res.ok;
}

/** Base64-encode an ArrayBuffer for a Resend attachment, chunked so a large file
 *  doesn't overflow the call stack via String.fromCharCode(...). */
export function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
