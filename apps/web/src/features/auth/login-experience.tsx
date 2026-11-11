"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LoginField } from "./login-field";

const ERROR_MESSAGES: Record<string, string> = {
  no_web_access:
    "Your role does not have web access. Please contact your administrator.",
  not_registered:
    "Your account is not registered in the system. Please contact your administrator.",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = { identifier?: string; password?: string };

const bannerClass =
  "rounded-md border border-destructive bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive";

export function LoginExperience({ error }: { readonly error?: string }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const staticError = error
    ? (ERROR_MESSAGES[error] ?? "An unexpected error occurred. Please try again.")
    : null;

  function clearFieldError(field: keyof FieldErrors) {
    setFieldErrors((f) => (f[field] ? { ...f, [field]: undefined } : f));
  }

  function validate(): boolean {
    const errs: FieldErrors = {};
    const id = identifier.trim();
    if (!id) errs.identifier = "Email or phone is required.";
    else if (!EMAIL_RE.test(id) && id.replace(/\D/g, "").length < 10)
      errs.identifier = "Enter a valid email or 10-digit phone number.";
    if (!password) errs.password = "Password is required.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setFormError(body.error ?? "Invalid email or password.");
        setIsSubmitting(false); // staying on the login page — re-enable the form
        return;
      }
      // Success: keep the loading state ON. Full-document navigation (NOT
      // router.push): the root layout must re-run with the new auth cookie to
      // resolve permissions. Resetting isSubmitting here would flip the button
      // back to "Sign in" during the ~1s reload (the flicker) — so we leave it
      // true; the page unloads and the state is discarded with it.
      window.location.assign("/auth/redirect");
    } catch {
      setFormError("Could not connect to the server. Please try again.");
      setIsSubmitting(false); // network error — re-enable the form
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10 text-foreground">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="text-center">
          <h1 className="whitespace-nowrap text-3xl font-extrabold tracking-tight">
            <span className="text-primary">Distribution</span>{" "}
            <span className="text-muted-foreground">OS</span>
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Sign in to your account</p>
        </div>

        {staticError && <div className={`mt-6 ${bannerClass}`}>{staticError}</div>}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
          <LoginField
            label="Email or phone number"
            name="identifier"
            type="text"
            autoComplete="username"
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
              clearFieldError("identifier");
            }}
            error={fieldErrors.identifier}
          />
          <LoginField
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearFieldError("password");
            }}
            error={fieldErrors.password}
          />

          {formError && <div className={bannerClass}>{formError}</div>}

          <Button type="submit" className="h-10 w-full text-base" disabled={isSubmitting}>
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <a href="/signup" className="font-semibold text-primary hover:underline">
            Sign up
          </a>
        </p>
      </div>
    </main>
  );
}
