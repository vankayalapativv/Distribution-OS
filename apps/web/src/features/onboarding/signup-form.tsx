"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Req() {
  return <span className="text-destructive"> *</span>;
}

export function SignupForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirm) return setError("Passwords don't match.");
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    setBusy(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, phone: form.phone, password: form.password }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Could not create your account.");
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
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
              Create your account
            </div>
            <h1 className="text-[23px] font-extrabold tracking-tight">Start your setup</h1>
            <p className="mb-6 mt-1.5 text-[13.5px] text-muted-foreground">
              This creates your login. You'll configure your company next.
            </p>

            {error ? (
              <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
                {error}
              </div>
            ) : null}

            <form onSubmit={submit} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <Label>Full name<Req /></Label>
                <Input value={form.name} onChange={set("name")} placeholder="Asha Rao" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Work email<Req /></Label>
                <Input type="email" value={form.email} onChange={set("email")} placeholder="asha@company.com" required />
                <span className="text-[11.5px] text-muted-foreground">We'll send a code to verify this address.</span>
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
                {busy ? "Creating account…" : "Create account"}
              </Button>
            </form>

            <div className="mt-4 text-center text-[13px] text-muted-foreground">
              Already have an account?{" "}
              <a href="/login" className="font-semibold text-primary">Sign in</a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
