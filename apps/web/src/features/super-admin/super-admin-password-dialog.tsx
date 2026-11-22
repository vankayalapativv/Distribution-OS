"use client";

import { type SyntheticEvent, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { errorMessage } from "@/lib/api-client";
import type { SuperAdminSetupUser } from "./super-admin-types";
import { PasswordSaved } from "./super-admin-password-saved";
import { PasswordForm } from "./super-admin-password-form";

/**
 * Sets a NEW password for a user (SUPER_ADMIN only). Existing passwords are
 * PBKDF2 hashes and can never be read back — so this deliberately reads "set",
 * not "show". The new value is displayed once here so it can be passed on.
 */
export function SetPasswordDialog({
  user,
  onClose,
}: {
  readonly user: SuperAdminSetupUser | null;
  readonly onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    // Wrapped so these aren't a synchronous setState in the effect body
    // (react-hooks/set-state-in-effect); timing is unchanged.
    function reset() {
      setPassword("");
      setSaved(null);
      setCopied(false);
      setError(null);
    }
    reset();
  }, [user]);

  async function handleSubmit(e: SyntheticEvent<HTMLFormElement>, u: SuperAdminSetupUser) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // Passwords live in Neon Auth — set via the admin BFF (Neon admin plugin).
      if (!u.appLoginId) {
        throw new Error("This account isn't linked to Neon Auth, so a password can't be set here.");
      }
      const res = await fetch("/api/admin/set-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ appLoginId: u.appLoginId, password: password.trim() || null }),
      });
      const json = (await res.json()) as { password?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not set the password.");
      setSaved(json.password ?? "");
    } catch (err) {
      setError(errorMessage(err, "Could not set the password."));
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Set password — {user.name}</DialogTitle>
          <DialogDescription>Set a new login password and hand it over once.</DialogDescription>
        </DialogHeader>

        {saved ? (
          <PasswordSaved
            saved={saved}
            userName={user.name}
            copied={copied}
            onCopy={() => void navigator.clipboard.writeText(saved).then(() => setCopied(true))}
            onClose={onClose}
          />
        ) : (
          <form onSubmit={(e) => handleSubmit(e, user)} className="flex min-h-0 flex-1 flex-col">
            <PasswordForm password={password} setPassword={setPassword} error={error} busy={busy} onClose={onClose} />
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
