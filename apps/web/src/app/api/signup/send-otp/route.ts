import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { otpEmail, sendEmail } from "../../../../lib/email/resend";
import {
  OTP_COOKIE,
  OTP_TTL_MS,
  generateCode,
  issueOtpCookie,
  normalizeEmail,
  resendCooldownRemaining,
} from "../../../../lib/otp";

/**
 * Step 1 of verify-before-create: validate the signup form, email a 6-digit
 * code, and remember it (hashed) in a signed httpOnly cookie. No account is
 * created yet — /api/signup does that only once the code is verified.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let name = "", email = "", phone = "", password = "";
  try {
    const b = (await request.json()) as Record<string, unknown>;
    name = String(b.name ?? "").trim();
    email = String(b.email ?? "").trim();
    phone = String(b.phone ?? "").trim();
    password = String(b.password ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!name || !email.includes("@") || !phone || password.length < 8) {
    return NextResponse.json(
      { error: "Enter your name, a valid email, your phone, and a password of at least 8 characters." },
      { status: 422 },
    );
  }

  const cookieStore = await cookies();
  const cooldown = await resendCooldownRemaining(cookieStore.get(OTP_COOKIE)?.value, email);
  if (cooldown > 0) {
    return NextResponse.json(
      { error: `Please wait ${Math.ceil(cooldown / 1000)}s before requesting another code.` },
      { status: 429 },
    );
  }

  const code = generateCode();
  const mail = otpEmail(code);
  const sent = await sendEmail({ to: normalizeEmail(email), subject: mail.subject, html: mail.html, text: mail.text });
  if (!sent.ok) {
    return NextResponse.json({ error: sent.error ?? "Could not send the verification code." }, { status: 502 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(OTP_COOKIE, await issueOtpCookie(email, code), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: Math.ceil(OTP_TTL_MS / 1000),
  });
  return response;
}
