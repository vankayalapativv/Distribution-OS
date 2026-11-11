import { useState } from "react";
import { useAuth } from "./auth";
import { getIsOnline } from "./connectivity";
import { humanizeError, type FriendlyError } from "./humanize-error";

// The domain's first label excludes '.', so there's no ambiguous overlap
// between `[^\s@]+` and `\.` — i.e. no super-linear backtracking (ReDoS-safe).
const EMAIL_RE = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/;

/** S2 — login form state: email + password, validation, submit. */
export function useLoginForm() {
  const login = useAuth((s) => s.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [feedback, setFeedback] = useState<FriendlyError | null>(null);
  const [busy, setBusy] = useState(false);

  function validate(): boolean {
    const errs: { email?: string; password?: string } = {};
    // `email` holds the login identifier — an email OR a phone number.
    const e = email.trim();
    if (!e) errs.email = "Email or phone is required.";
    else if (!EMAIL_RE.test(e) && e.replace(/\D/g, "").length < 10)
      errs.email = "Enter a valid email or 10-digit phone number.";
    if (!password) errs.password = "Password is required.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function onEmailChange(t: string) {
    setEmail(t);
    if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined }));
  }

  function onPasswordChange(t: string) {
    setPassword(t);
    if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: undefined }));
  }

  function toggleShow() {
    setShowPassword((s) => !s);
  }

  async function onSubmit() {
    if (busy) return;
    setFeedback(null);
    if (!validate()) return;
    setBusy(true);
    try {
      await login(email.trim(), password);
      // AuthGate redirects to "/" once the token lands in the store.
    } catch (e) {
      // One friendly, severity-tagged result for every failure — a real 4xx keeps
      // its server message, a billing block reads as a warning, and a DNS/network
      // failure on weak 4G becomes a prompt instead of a raw Java stack trace.
      setFeedback(humanizeError(e, { online: getIsOnline() }));
    } finally {
      setBusy(false);
    }
  }

  return {
    email,
    onEmailChange,
    password,
    onPasswordChange,
    showPassword,
    toggleShow,
    fieldErrors,
    feedback,
    busy,
    onSubmit,
  };
}
