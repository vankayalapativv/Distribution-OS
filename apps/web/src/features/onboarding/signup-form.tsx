"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Req() {
  return <span className="text-destructive"> *</span>;
}

/** Inline, per-field validation message shown directly under the input. */
function FieldError({ id, children }: { readonly id?: string; readonly children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="text-[11.5px] font-medium text-destructive">
      {children}
    </p>
  );
}

/** A general (non-field) error banner with a warning icon — for network / server
 *  failures that don't belong to a single input. */
function ErrorBanner({ children }: { readonly children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[13px] text-destructive"
    >
      <svg aria-hidden className="mt-[1px] h-4 w-4 flex-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{children}</span>
    </div>
  );
}

/** One benefit row in the brand panel: icon chip + title + supporting line. */
function Feature({ icon, title, children }: { readonly icon: React.ReactNode; readonly title: string; readonly children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg bg-[rgba(255,255,255,0.15)] text-white">
        {icon}
      </span>
      <div>
        <div className="text-[14px] font-semibold text-white">{title}</div>
        <div className="mt-[2px] text-[12.5px] leading-[1.45] text-[#bcd2ff]">{children}</div>
      </div>
    </div>
  );
}

/** Six-box verification code input, backed by a single string. Auto-advances,
 *  supports backspace across boxes and pasting the whole code. */
function CodeBoxes({
  value,
  onChange,
  disabled,
  invalid,
  autoFocus,
}: {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly disabled?: boolean;
  readonly invalid?: boolean;
  readonly autoFocus?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const focus = (i: number) => refs.current[Math.max(0, Math.min(5, i))]?.focus();

  const write = (start: number, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    const arr = Array.from({ length: 6 }, (_, k) => value[k] ?? "");
    if (!digits) {
      arr[start] = "";
      onChange(arr.join(""));
      return;
    }
    let j = start;
    for (const ch of digits) {
      if (j > 5) break;
      arr[j] = ch;
      j += 1;
    }
    onChange(arr.join(""));
    focus(Math.min(j, 5));
  };

  return (
    // Fluid 6-column grid so the boxes always fit the form width (fixed widths
    // overflowed the ~284px form column on a phone).
    <div className="grid grid-cols-6 gap-2 sm:gap-2.5">
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={value[i] ?? ""}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          aria-invalid={invalid}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => write(i, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !value[i] && i > 0) focus(i - 1);
            if (e.key === "ArrowLeft" && i > 0) focus(i - 1);
            if (e.key === "ArrowRight" && i < 5) focus(i + 1);
          }}
          onPaste={(e) => {
            e.preventDefault();
            write(0, e.clipboardData.getData("text"));
          }}
          className={`h-14 w-full min-w-0 rounded-xl border bg-transparent text-center text-[20px] font-semibold tabular-nums outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 disabled:opacity-60 sm:text-[22px] ${value[i] ? "border-foreground/30 bg-muted/40" : "border-input"}`}
        />
      ))}
    </div>
  );
}

const RESEND_COOLDOWN = 30;

export function SignupForm() {
  const router = useRouter();
  const [phase, setPhase] = useState<"form" | "otp">("form");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  // Resend has its own in-flight + just-sent flags so it never disables the code
  // boxes (busy is for the create/verify calls) and can confirm inline.
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  // Bumping this remounts CodeBoxes → it clears and refocuses the first box.
  const [otpKey, setOtpKey] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof typeof form | "code", string>>>({});
  // The code we've already auto-submitted, so the effect doesn't re-fire for it.
  const submittedRef = useRef("");

  // Editing a field clears its own error (and any general banner), so a
  // correction visibly resolves the message as the user types.
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setFieldErrors((fe) => (fe[k] ? { ...fe, [k]: undefined } : fe));
    if (error) setError(null);
  };

  // Resend cooldown ticker.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode(resend = false) {
    setError(null);
    if (resend) setResending(true);
    else setBusy(true);
    const done = () => (resend ? setResending(false) : setBusy(false));
    try {
      const res = await fetch("/api/signup/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, phone: form.phone, password: form.password }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; field?: string };
      if (!res.ok) {
        // A taken email/phone comes back tagged with its field → show it on the
        // input, not as a generic banner. Everything else is a general failure.
        if (body.field === "email" || body.field === "phone") {
          setFieldErrors((fe) => ({ ...fe, [body.field as "email" | "phone"]: body.error ?? "Already in use." }));
        } else {
          setError(body.error ?? "Could not send the verification code.");
        }
        done();
        return false;
      }
      setPhase("otp");
      setCooldown(RESEND_COOLDOWN);
      if (resend) {
        // Fresh code → clear the stale digits, refocus, and confirm inline briefly.
        setCode("");
        submittedRef.current = "";
        setOtpKey((k) => k + 1);
        setFieldErrors((fe) => ({ ...fe, code: undefined }));
        setResent(true);
        window.setTimeout(() => setResent(false), 4000);
      }
      done();
      return true;
    } catch {
      setError("Network error. Please try again.");
      done();
      return false;
    }
  }

  function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fe: Partial<Record<keyof typeof form, string>> = {};
    if (!form.name.trim()) fe.name = "Enter your name.";
    if (!form.email.trim() || !form.email.includes("@")) fe.email = "Enter a valid email address.";
    if (!form.phone.trim()) fe.phone = "Enter your mobile number.";
    if (form.password.length < 8) fe.password = "At least 8 characters.";
    setFieldErrors(fe);
    if (Object.keys(fe).length > 0) return;
    void sendCode(false);
  }

  const doVerify = useCallback(async () => {
    setError(null);
    setFieldErrors((fe) => ({ ...fe, code: undefined }));
    if (code.trim().length !== 6) {
      setFieldErrors((fe) => ({ ...fe, code: "Enter the 6-digit code from your email." }));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          password: form.password,
          code: code.trim(),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; otp?: string };
      if (!res.ok) {
        // Code-related failures belong on the code field; anything else (e.g. the
        // account could not be created) is a general banner.
        if (body.otp) {
          setFieldErrors((fe) => ({ ...fe, code: body.error ?? "That code is incorrect." }));
        } else {
          setError(body.error ?? "Could not create your account.");
        }
        // Clear + refocus the boxes so the next attempt starts clean; resetting
        // submittedRef lets the same digits be re-tried (e.g. a transient error).
        setCode("");
        submittedRef.current = "";
        setOtpKey((k) => k + 1);
        setBusy(false);
        return;
      }
      setVerified(true); // brief success state before the onboarding redirect
      router.push("/onboarding");
    } catch {
      setError("Network error. Please try again.");
      setCode("");
      submittedRef.current = "";
      setOtpKey((k) => k + 1);
      setBusy(false);
    }
  }, [code, form, router]);

  // Auto-verify the instant all six digits are present — no button press needed.
  // submittedRef guards against re-firing for a code already in flight.
  useEffect(() => {
    if (phase === "otp" && code.length === 6 && !busy && !verified && submittedRef.current !== code) {
      submittedRef.current = code;
      void doVerify();
    }
  }, [phase, code, busy, verified, doVerify]);

  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{
        // Hex (not oklch) so it renders on pre-2023 browsers (e.g. Win 7/8 Chromium).
        backgroundColor: "#f2f5f9",
        backgroundImage:
          "radial-gradient(1100px 560px at 12% -8%, #dbe9fc, transparent 55%), radial-gradient(900px 620px at 112% 118%, #dee9f9, transparent 50%)",
      }}
    >
      {/* ~70% × 70% centered split surface on laptop+; a single full card below lg
          (at md the 70vw box is too narrow for the two-column split). Height is a
          MIN, so the card grows to fit its content instead of scrolling inside. */}
      <div className="flex min-h-[70vh] w-[70vw] max-w-[1180px] overflow-hidden rounded-[20px] border border-border bg-card shadow-[0_18px_50px_-20px_rgba(15,23,42,0.30),0_4px_14px_-8px_rgba(15,23,42,0.18)] max-lg:min-h-0 max-lg:w-full max-lg:max-w-[440px]">
        {/* ── Brand panel (shown on laptop+ only) ── */}
        <aside
          className="relative hidden w-[44%] overflow-hidden p-[46px] lg:block"
          style={{
            backgroundColor: "#2751b8",
            backgroundImage:
              "linear-gradient(155deg, #2751b8 0%, #3a81f5 62%, #59a0f9 100%)",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              background:
                "radial-gradient(420px 300px at 85% 8%, rgba(255,255,255,0.18), transparent 60%), radial-gradient(360px 300px at 0% 100%, rgba(255,255,255,0.12), transparent 60%)",
            }}
          />
          <div className="relative flex h-full flex-col">
            <h2 className="max-w-[15ch] text-[27px] font-bold leading-[1.18] tracking-tight text-white text-balance">
              Everything your distribution business runs on.
            </h2>
            <p className="mt-2.5 max-w-[32ch] text-[14px] leading-[1.5] text-[#c9dcff]">
              Orders, invoicing, field tracking and collections — one place for your whole team.
            </p>

            <div className="mt-8 flex flex-col gap-4">
              <Feature
                title="GST tax invoices"
                icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" /><path d="M9 13h6M9 17h4" /></svg>}
              >
                Compliant billing with e-way-ready exports.
              </Feature>
              <Feature
                title="Live field tracking"
                icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-5.6-7-11a7 7 0 0 1 14 0c0 5.4-7 11-7 11Z" /><circle cx="12" cy="10" r="2.4" /></svg>}
              >
                Beats, visits and routes for every executive.
              </Feature>
              <Feature
                title="Collections & dues"
                icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h18v12H3z" /><path d="M3 10h18" /><path d="M7 15h4" /></svg>}
              >
                Ledgers, ageing and reconciliation in sync.
              </Feature>
            </div>

            <div className="mt-auto border-t border-[rgba(255,255,255,0.2)] pt-3.5 text-[12px] text-[#aec5ee]">
              Vardhan Systems · set up your company in minutes.
            </div>
          </div>
        </aside>

        {/* ── Form side ── */}
        <div className="flex flex-1 items-center justify-center p-10 max-lg:p-7">
          <div className="w-full max-w-[360px]">
            {error ? <ErrorBanner>{error}</ErrorBanner> : null}

            {phase === "form" ? (
              <>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                  Create account
                </div>
                <h1 className="text-[24px] font-bold tracking-tight text-balance">Create your account</h1>
                <p className="mb-6 mt-1.5 text-[13.5px] text-muted-foreground">
                  You&apos;ll be the first Super Admin for your company.
                </p>

                <form onSubmit={submitForm} className="flex flex-col gap-[15px]">
                  <div className="flex flex-col gap-1.5">
                    <Label>Full name<Req /></Label>
                    <Input className="h-11" value={form.name} onChange={set("name")} placeholder="Asha Rao" autoComplete="name" aria-invalid={Boolean(fieldErrors.name)} required />
                    <FieldError>{fieldErrors.name}</FieldError>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Work email<Req /></Label>
                    <Input className="h-11" type="email" value={form.email} onChange={set("email")} placeholder="asha@company.com" autoComplete="email" aria-invalid={Boolean(fieldErrors.email)} required />
                    {fieldErrors.email ? (
                      <FieldError>
                        {fieldErrors.email}{" "}
                        {fieldErrors.email.includes("already registered") ? (
                          <a href="/login" className="font-semibold underline">Sign in</a>
                        ) : null}
                      </FieldError>
                    ) : (
                      <span className="text-[11.5px] text-muted-foreground">We&apos;ll send a code to verify this address.</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Mobile number<Req /></Label>
                    <Input className="h-11" inputMode="tel" value={form.phone} onChange={set("phone")} placeholder="+91 98765 43210" autoComplete="tel" aria-invalid={Boolean(fieldErrors.phone)} required />
                    <FieldError>{fieldErrors.phone}</FieldError>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Password<Req /></Label>
                    <div className="relative">
                      <Input
                        className="h-11 pr-10"
                        type={showPw ? "text" : "password"}
                        value={form.password}
                        onChange={set("password")}
                        placeholder="At least 8 characters"
                        autoComplete="new-password"
                        aria-invalid={Boolean(fieldErrors.password)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((s) => !s)}
                        aria-label={showPw ? "Hide password" : "Show password"}
                        className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        {showPw ? (
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
                        ) : (
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                        )}
                      </button>
                    </div>
                    {fieldErrors.password ? (
                      <FieldError>{fieldErrors.password}</FieldError>
                    ) : (
                      <span className="text-[11.5px] text-muted-foreground">Use 8 or more characters.</span>
                    )}
                  </div>
                  <Button type="submit" className="mt-1 h-11 w-full" disabled={busy}>
                    {busy ? "Sending code…" : "Create account"}
                  </Button>
                </form>

                <div className="mt-4 text-[13px] text-muted-foreground">
                  Already have an account?{" "}
                  <a href="/login" className="font-semibold text-primary">Sign in</a>
                </div>
              </>
            ) : (
              <>
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m3 7 9 6 9-6" />
                  </svg>
                </div>
                <h1 className="text-[24px] font-bold tracking-tight text-balance">Check your inbox</h1>
                <p className="mb-6 mt-1.5 text-[13.5px] leading-[1.5] text-muted-foreground">
                  Enter the 6-digit code we sent to{" "}
                  <span className="font-semibold text-foreground">{form.email}</span>.
                </p>

                <form onSubmit={(e) => { e.preventDefault(); void doVerify(); }} className="flex flex-col gap-3.5">
                  <div className="flex flex-col gap-2">
                    <CodeBoxes
                      key={otpKey}
                      value={code}
                      onChange={(v) => {
                        setCode(v);
                        setFieldErrors((fe) => (fe.code ? { ...fe, code: undefined } : fe));
                      }}
                      invalid={Boolean(fieldErrors.code)}
                      disabled={busy || verified}
                      autoFocus
                    />
                    {fieldErrors.code ? (
                      <FieldError>{fieldErrors.code}</FieldError>
                    ) : (
                      <p className="text-[11.5px] text-muted-foreground">Verifies automatically once all six digits are entered.</p>
                    )}
                  </div>
                  <Button type="submit" className="mt-1 h-11 w-full" disabled={busy || verified || code.length !== 6}>
                    {verified ? (
                      <span className="inline-flex items-center gap-1.5">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
                        Verified
                      </span>
                    ) : busy ? "Verifying…" : "Verify & continue"}
                  </Button>
                </form>

                <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 text-[13px]">
                  <div className="flex min-h-[20px] flex-wrap items-center gap-x-1.5 gap-y-1 text-muted-foreground">
                    <span>Didn&apos;t get the code?</span>
                    {cooldown > 0 ? (
                      <span className="tabular-nums">Resend in {cooldown}s</span>
                    ) : (
                      <button
                        type="button"
                        disabled={resending || busy || verified}
                        onClick={() => void sendCode(true)}
                        className="font-semibold text-primary underline-offset-2 transition-colors hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
                      >
                        {resending ? "Sending…" : "Resend code"}
                      </button>
                    )}
                    {resent ? (
                      <span className="inline-flex items-center gap-1 font-medium text-[#1c8742]">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                        New code sent
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPhase("form");
                      setCode("");
                      submittedRef.current = "";
                      setError(null);
                      setResent(false);
                      setFieldErrors((fe) => ({ ...fe, code: undefined }));
                    }}
                    disabled={busy || verified}
                    className="self-start font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                  >
                    Change email
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
