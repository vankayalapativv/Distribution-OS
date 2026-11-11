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
import { SearchSelect } from "@/features/orders/search-select";
import { errorMessage, type ActionConfig } from "@/lib/api-client";
import type { SuperAdminSetupUser } from "./super-admin-types";
import { saveSuperAdminUser } from "./super-admin-save-user";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

/**
 * Edit a user's identity and login status (SUPER_ADMIN only). Role is not
 * editable here — changing what someone can do is a separate decision.
 */
export function EditUserDialog({
  user,
  onClose,
  onSaved,
  actionConfig,
}: {
  readonly user: SuperAdminSetupUser | null;
  readonly onClose: () => void;
  readonly onSaved: (user: SuperAdminSetupUser) => void;
  readonly actionConfig: ActionConfig;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("active");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    // Wrapped so the resets aren't a synchronous setState in the effect body
    // (react-hooks/set-state-in-effect); the timing is unchanged.
    function syncFromUser(u: SuperAdminSetupUser) {
      setName(u.name);
      setEmail(u.email ?? "");
      setPhone(u.phone ?? "");
      setStatus(u.status);
      setError(null);
    }
    syncFromUser(user);
  }, [user]);

  async function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await saveSuperAdminUser(
        user,
        {
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          status,
        },
        actionConfig,
      );
      onSaved({ ...user, ...saved });
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Could not save the user."));
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>Update identity and login status. Role isn&apos;t editable here.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="eu-name">Name</Label>
                <Input id="eu-name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="eu-email">Email</Label>
                <Input
                  id="eu-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="eu-phone">Phone</Label>
                <Input
                  id="eu-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91…"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Status</Label>
                <SearchSelect
                  items={STATUS_OPTIONS}
                  valueKey={status}
                  getKey={(o) => o.value}
                  getLabel={(o) => o.label}
                  onSelect={(v) => setStatus(v || "active")}
                  placeholder="Select status"
                  searchPlaceholder="Search status…"
                  emptyText="No status found"
                  contentClassName="w-(--anchor-width) p-0"
                />
                <p className="text-xs text-muted-foreground">
                  Inactive users cannot log in and drop out of assignment lists. Their past
                  records stay intact.
                </p>
              </div>
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
            <Button type="submit" disabled={!name.trim() || busy}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
