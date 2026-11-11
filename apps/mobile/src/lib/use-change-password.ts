import { router } from "expo-router";
import { useState } from "react";
import { apiFetch } from "./api";
import { useAuth } from "./auth";

/** Form state + save for the change-password screen: current + new (min 8) + confirm. */
export function useChangePassword() {
  const token = useAuth((s) => s.token);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const tooShort = next.length > 0 && next.length < 8;
  const mismatch = confirm.length > 0 && confirm !== next;
  const canSave = current.length > 0 && next.length >= 8 && confirm === next && !busy;

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
      setTimeout(() => router.back(), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change password. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return {
    current,
    setCurrent,
    next,
    setNext,
    confirm,
    setConfirm,
    busy,
    error,
    saved,
    tooShort,
    mismatch,
    canSave,
    onSave,
  };
}
