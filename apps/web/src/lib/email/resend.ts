import "server-only";

/**
 * Minimal Resend REST client (no SDK — a single fetch, Workers/Edge-safe).
 * Sends transactional email from the web BFF. `RESEND_API_KEY` is required;
 * `OTP_FROM_EMAIL` defaults to Resend's shared sender, which in test mode only
 * delivers to the address on the Resend account — set a verified-domain sender
 * for production.
 */
const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_FROM = "Distribution OS <onboarding@resend.dev>";

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<SendEmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return { ok: false, error: "Email is not configured (RESEND_API_KEY is missing)." };
  }
  const from = process.env.OTP_FROM_EMAIL || DEFAULT_FROM;

  let res: Response;
  try {
    res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ from, to: input.to, subject: input.subject, html: input.html, text: input.text }),
    });
  } catch {
    return { ok: false, error: "Could not reach the email service." };
  }

  if (!res.ok) {
    let error = "The email could not be sent.";
    try {
      const b = (await res.json()) as { message?: string; error?: string };
      error = b.message ?? b.error ?? error;
    } catch {
      /* keep default */
    }
    return { ok: false, error };
  }

  let id: string | undefined;
  try {
    id = ((await res.json()) as { id?: string }).id;
  } catch {
    /* id is non-essential */
  }
  return { ok: true, id };
}

/** The signup verification-code email. */
export function otpEmail(code: string): { subject: string; html: string; text: string } {
  const subject = `${code} is your Distribution OS verification code`;
  const text =
    `Your Distribution OS verification code is ${code}.\n\n` +
    `It expires in 10 minutes. If you didn't request this, you can ignore this email.`;
  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f4f6fb;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
    <div style="max-width:440px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
      <div style="padding:20px 24px;border-bottom:1px solid #eef2f7">
        <span style="font-size:15px;font-weight:800;letter-spacing:-0.3px">Distribution&nbsp;OS</span>
      </div>
      <div style="padding:26px 24px">
        <p style="margin:0 0 6px;font-size:14px;color:#475569">Verify your email to finish creating your account.</p>
        <div style="margin:18px 0;font-size:34px;font-weight:800;letter-spacing:8px;text-align:center;color:#1d4ed8">${code}</div>
        <p style="margin:0;font-size:12.5px;color:#64748b;text-align:center">This code expires in 10 minutes.</p>
      </div>
      <div style="padding:14px 24px;border-top:1px solid #eef2f7;font-size:11.5px;color:#94a3b8">
        If you didn't request this, you can safely ignore this email. · Vardhan Systems
      </div>
    </div>
  </body>
</html>`;
  return { subject, html, text };
}
