import { router } from "expo-router";
import { useState } from "react";
import { apiFetch } from "./api";
import { useAuth } from "./auth";

/** New-password policy: at least 8 chars, with a letter and a number (mirrors the
 *  server rule in apps/api/src/lib/password-policy.ts). */
export const PW_MIN = 8;
export function passwordRules(pw: string) {
  const longEnough = pw.length >= PW_MIN;
  const hasLetter = /[A-Za-z]/.test(pw);
  const hasNumber = /[0-9]/.test(pw);
  return { longEnough, hasLetter, hasNumber, ok: longEnough && hasLetter && hasNumber };
}
/** 0–4 strength score for the meter (length milestones + variety). */
export function passwordStrength(pw: string): number {
  if (pw.length === 0) return 0;
  let s = 0;
  if (pw.length >= PW_MIN) s += 1;
  if (pw.length >= 12) s += 1;
  if (/[A-Za-z]/.test(pw) && /[0-9]/.test(pw)) s += 1;
  if (/[^A-Za-z0-9]/.test(pw)) s += 1;
  return s;
}

/** Form state + save for the change-password screen: current + new + confirm. */
export function useChangePassword() {
  const token = useAuth((s) => s.token);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const rules = passwordRules(next);
  const strength = passwordStrength(next);
  const mismatch = confirm.length > 0 && confirm !== next;
  // A wrong-current-password error is shown inline under the Current field.
  const wrongCurrent = /current password/i.test(error ?? "");
  const canSave = current.length > 0 && rules.ok && confirm === next && !busy && !saved;

  // Typing in any field clears a stale server error so it doesn't linger.
  const edit = (set: (v: string) => void) => (v: string) => {
    set(v);
    if (error) setError(null);
  };

  async function onSave() {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await apiFetch("/me/change-password", {
        method: "POST",
        token,
        body: { currentPassword: current, newPassword: next },
      });
      setSaved(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      setTimeout(() => router.back(), 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change password. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return {
    current,
    setCurrent: edit(setCurrent),
    next,
    setNext: edit(setNext),
    confirm,
    setConfirm: edit(setConfirm),
    busy,
    error,
    saved,
    rules,
    strength,
    mismatch,
    wrongCurrent,
    canSave,
    onSave,
  };
}
