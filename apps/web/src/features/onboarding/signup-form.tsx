"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Req() {
  return <span className="text-destructive"> *</span>;
}

const RESEND_COOLDOWN = 30;

export function SignupForm() {
  const router = useRouter();
  const [phase, setPhase] = useState<"form" | "otp">("form");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirm: "" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // Resend cooldown ticker.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode(resend = false) {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch("/api/signup/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, phone: form.phone, password: form.password }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Could not send the verification code.");
        setBusy(false);
        return false;
      }
      setPhase("otp");
      setCooldown(RESEND_COOLDOWN);
      if (resend) setNotice("A new code is on its way.");
      setBusy(false);
      return true;
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
      return false;
    }
  }

  function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirm) return setError("Passwords don't match.");
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    void sendCode(false);
  }

  async function verifyAndCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (code.trim().length !== 6) return setError("Enter the 6-digit code from your email.");
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
        setError(body.error ?? "Could not create your account.");
        // Expired / too many attempts → send them back to request a fresh code.
        if (body.otp === "expired" || body.otp === "missing" || body.otp === "too_many") {
          setCode("");
        }
        setBusy(false);
        return;
      }
      router.push("/onboarding");
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-2 border-b border-border px-5 py-3">
        <span className="text-[15px] font-extrabold tracking-tight">Distribution&nbsp;OS</span>
        <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Sign up</span>
      </header>

      <main className="px-4 py-8">
        <div className="mx-auto grid max-w-[980px] items-stretch gap-7 md:grid-cols-[1.05fr_0.95fr]">
          <aside
            className="relative hidden overflow-hidden rounded-[10px] border p-8 text-[#eaf1fe] md:block"
            style={{
              background:
                "linear-gradient(160deg, oklch(0.6231 0.1880 259.81), oklch(0.4244 0.1809 265.64) 82%)",
              borderColor: "oklch(0.4244 0.1809 265.64)",
            }}
          >
            <h2 className="max-w-[14ch] text-[25px] font-extrabold leading-[1.12] tracking-tight text-white">
              Run your distribution business on one system.
            </h2>
            <p className="mt-3 max-w-[34ch] text-[13.5px] text-[#cfddfa]">
              Orders, invoicing, stock, collections and field tracking — set up in minutes.
            </p>
            <ul className="mt-6 flex list-none flex-col gap-3 p-0">
              {[
                "Your data stays private to your company.",
                "Web dashboard for admins, mobile app for the field team.",
                "GST invoicing, dues ageing and live tracking built in.",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3 text-[13px] text-[#dde7fb]">
                  <span className="mt-[7px] h-[7px] w-[7px] flex-none rounded-full bg-white" />
                  {t}
                </li>
              ))}
            </ul>
            <div className="absolute inset-x-8 bottom-6 border-t border-white/20 pt-3.5 text-[11.5px] text-[#aec5ee]">
              Vardhan Systems · support 8am–4pm IST
            </div>
          </aside>

          <div className="rounded-[10px] border border-border bg-card p-8 shadow-sm">
            {error ? (
              <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
                {error}
              </div>
            ) : null}
            {notice ? (
              <div className="mb-4 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-[13px] text-primary">
                {notice}
              </div>
            ) : null}

            {phase === "form" ? (
              <>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                  Create your account
                </div>
                <h1 className="text-[23px] font-extrabold tracking-tight">Start your setup</h1>
                <p className="mb-6 mt-1.5 text-[13.5px] text-muted-foreground">
                  This creates your login. You&apos;ll configure your company next.
                </p>

                <form onSubmit={submitForm} className="flex flex-col gap-3.5">
                  <div className="flex flex-col gap-1.5">
                    <Label>Full name<Req /></Label>
                    <Input value={form.name} onChange={set("name")} placeholder="Asha Rao" required />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Work email<Req /></Label>
                    <Input type="email" value={form.email} onChange={set("email")} placeholder="asha@company.com" required />
                    <span className="text-[11.5px] text-muted-foreground">We&apos;ll send a code to verify this address.</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Mobile number<Req /></Label>
                    <Input inputMode="tel" value={form.phone} onChange={set("phone")} placeholder="+91 98765 43210" required />
                  </div>
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label>Password<Req /></Label>
                      <Input type="password" value={form.password} onChange={set("password")} placeholder="Min. 8 characters" required />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Confirm password<Req /></Label>
                      <Input type="password" value={form.confirm} onChange={set("confirm")} placeholder="Re-enter" required />
                    </div>
                  </div>
                  <Button type="submit" className="mt-1.5 w-full" disabled={busy}>
                    {busy ? "Sending code…" : "Continue"}
                  </Button>
                </form>

                <div className="mt-4 text-center text-[13px] text-muted-foreground">
                  Already have an account?{" "}
                  <a href="/login" className="font-semibold text-primary">Sign in</a>
                </div>
              </>
            ) : (
              <>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                  Verify your email
                </div>
                <h1 className="text-[23px] font-extrabold tracking-tight">Check your email</h1>
                <p className="mb-6 mt-1.5 text-[13.5px] text-muted-foreground">
                  We sent a 6-digit code to <span className="font-semibold text-foreground">{form.email}</span>. Enter it
                  below to finish creating your account.
                </p>

                <form onSubmit={verifyAndCreate} className="flex flex-col gap-3.5">
                  <div className="flex flex-col gap-1.5">
                    <Label>Verification code<Req /></Label>
                    <Input
                      autoFocus
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="••••••"
                      className="text-center text-[22px] font-semibold tracking-[0.5em]"
                      required
                    />
                  </div>
                  <Button type="submit" className="mt-1.5 w-full" disabled={busy || code.length !== 6}>
                    {busy ? "Verifying…" : "Verify & create account"}
                  </Button>
                </form>

                <div className="mt-4 flex items-center justify-between text-[13px]">
                  <button
                    type="button"
                    onClick={() => {
                      setPhase("form");
                      setCode("");
                      setError(null);
                      setNotice(null);
                    }}
                    className="font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Use a different email
                  </button>
                  <button
                    type="button"
                    disabled={cooldown > 0 || busy}
                    onClick={() => void sendCode(true)}
                    className="font-semibold text-primary disabled:cursor-not-allowed disabled:text-muted-foreground"
                  >
                    {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
