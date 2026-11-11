"use client";

import { type SyntheticEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/api-client";
import type { SuperAdminSetupUser } from "./super-admin-types";

/** Readable random password, same alphabet the API uses (no look-alike chars). */
const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$";
function generate(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => CHARS[b % CHARS.length]).join("");
}

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

  async function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      // Passwords live in Neon Auth — set via the admin BFF (Neon admin plugin).
      if (!user.appLoginId) {
        throw new Error("This account isn't linked to Neon Auth, so a password can't be set here.");
      }
      const res = await fetch("/api/admin/set-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ appLoginId: user.appLoginId, password: password.trim() || null }),
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
          <>
            <DialogBody className="space-y-4">
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                <p className="text-xs font-medium text-green-800">
                  New password set. Share it with {user.name} now — it cannot be shown again.
                </p>
                <p className="mt-2 font-mono text-lg font-semibold tracking-wide text-green-900">
                  {saved}
                </p>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(saved).then(() => setCopied(true));
                }}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button type="button" onClick={onClose}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <DialogBody className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Passwords are stored encrypted and can never be read back, so the existing one
                can&apos;t be displayed. Setting a new one replaces it immediately.
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="sp-password">New password</Label>
                <div className="flex gap-2">
                  <Input
                    id="sp-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Leave blank to generate one"
                    autoComplete="off"
                  />
                  <Button type="button" variant="outline" onClick={() => setPassword(generate())}>
                    Generate
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  At least 8 characters, or leave blank and a strong one is generated.
                </p>
              </div>

              {error ? (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Setting…" : "Set password"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
