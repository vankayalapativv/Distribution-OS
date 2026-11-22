"use client";

import { Button } from "@/components/ui/button";
import { DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Readable random password, same alphabet the API uses (no look-alike chars). */
const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$";
export function generate(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => CHARS[b % CHARS.length]).join("");
}

/** The set-password form body (password input + Generate + error + footer). */
export function PasswordForm({
  password,
  setPassword,
  error,
  busy,
  onClose,
}: Readonly<{
  password: string;
  setPassword: (v: string) => void;
  error: string | null;
  busy: boolean;
  onClose: () => void;
}>) {
  return (
    <>
      <DialogBody className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Passwords are stored encrypted and can never be read back, so the existing one can&apos;t be
          displayed. Setting a new one replaces it immediately.
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
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
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
    </>
  );
}
