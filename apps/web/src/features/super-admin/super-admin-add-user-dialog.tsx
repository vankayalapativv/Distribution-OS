"use client";

import { type SyntheticEvent, useState } from "react";
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
import { SearchSelect } from "@/components/ui/search-select";
import { errorMessage } from "@/lib/api-client";
import { CredentialsPanel, SuperAdminConfirmPanel } from "./super-admin-add-user-panels";
import type {
  CreatedCredentials,
  CreatedUser,
  CreateUserPayload,
  SuperAdminActionConfig,
  SuperAdminSetupUser,
} from "./super-admin-types";

interface AddUserDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly actionConfig: SuperAdminActionConfig;
  readonly onUserCreated: (user: SuperAdminSetupUser) => void;
}

const ROLE_OPTIONS = [
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "MANAGER", label: "Manager" },
  { value: "ACCOUNTANT", label: "Accountant" },
  { value: "SALES_EXECUTIVE", label: "Sales Executive" },
  { value: "LOGISTICS", label: "Logistics" },
];

export function AddUserDialog({
  open,
  onOpenChange,
  onUserCreated,
}: AddUserDialogProps) {
  const [userRole, setUserRole] = useState("SALES_EXECUTIVE");
  // Controlled so the values survive the Super Admin confirmation step (the form unmounts there).
  const [userName, setUserName] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<CreatedCredentials | null>(null);
  const [copied, setCopied] = useState(false);
  // When creating a SUPER_ADMIN, hold the payload here and require an explicit confirm first.
  const [pendingSuperAdmin, setPendingSuperAdmin] = useState<CreateUserPayload | null>(null);

  function handleCreateUser(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setUserFormError(null);

    const trimmedEmail = userEmail.trim();
    const trimmedPhone = userPhone.trim();
    const payload: CreateUserPayload = {
      name: userName.trim(),
      email: trimmedEmail === "" ? null : trimmedEmail,
      phone: trimmedPhone === "" ? null : trimmedPhone,
      role: userRole,
    };

    // Creating another Super Admin grants full system access — require an explicit confirm.
    if (payload.role === "SUPER_ADMIN") {
      setPendingSuperAdmin(payload);
      return;
    }

    void submitUser(payload);
  }

  async function submitUser(payload: CreateUserPayload) {
    setIsCreatingUser(true);
    setUserFormError(null);

    try {
      // Admin provisioning goes through the same-origin BFF, which creates the
      // Neon Auth identity (admin plugin) + the linked app users row.
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const user = (await res.json()) as CreatedUser & { error?: string };
      if (!res.ok) throw new Error(user.error ?? "User creation failed.");

      onUserCreated({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        status: user.status,
        appLoginId: user.appLoginId,
        roles: [user.role],
      });

      setCreatedCredentials({
        email: user.email ?? "",
        password: user.generatedPassword,
        name: user.name,
      });
    } catch (error) {
      setUserFormError(errorMessage(error, "User creation failed."));
    } finally {
      setIsCreatingUser(false);
      setPendingSuperAdmin(null);
    }
  }

  async function copyCredentials(creds: CreatedCredentials) {
    const text = `Name: ${creds.name}\nEmail: ${creds.email}\nPassword: ${creds.password}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onOpenChange(false); }}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>
            {createdCredentials ? "Credentials created" : "Add user"}
          </DialogTitle>
          <DialogDescription>
            {(() => {
              if (createdCredentials) return "Share these login details securely — the password can't be shown again.";
              if (pendingSuperAdmin) return "Confirm creating a full-access account.";
              return "Create a login for a team member.";
            })()}
          </DialogDescription>
        </DialogHeader>

        {(() => { if (createdCredentials) return (
          <DialogBody className="space-y-4">
            <CredentialsPanel
              credentials={createdCredentials}
              copied={copied}
              onCopy={copyCredentials}
              onDone={() => onOpenChange(false)}
            />
          </DialogBody>
        ); if (pendingSuperAdmin) return (
          <DialogBody className="space-y-4">
            <SuperAdminConfirmPanel
              payload={pendingSuperAdmin}
              isCreating={isCreatingUser}
              error={userFormError}
              onConfirm={() => void submitUser(pendingSuperAdmin)}
              onBack={() => setPendingSuperAdmin(null)}
            />
          </DialogBody>
        ); return (
          <form onSubmit={handleCreateUser} className="flex min-h-0 flex-1 flex-col">
            <DialogBody className="space-y-4">
              <div className="grid gap-1.5">
                <Label>Role</Label>
                <SearchSelect
                  items={ROLE_OPTIONS}
                  valueKey={userRole}
                  getKey={(r) => r.value}
                  getLabel={(r) => r.label}
                  onSelect={(v) => { if (v) setUserRole(v); }}
                  placeholder="Select a role"
                  searchPlaceholder="Search role…"
                  emptyText="No role found"
                  contentClassName="w-[320px] p-0"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="modal-user-name">Name</Label>
                <Input id="modal-user-name" name="name" placeholder="Full name" required
                  value={userName} onChange={(e) => setUserName(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="modal-user-phone">Phone</Label>
                <Input id="modal-user-phone" name="phone" type="tel" placeholder="+91 98765 43210"
                  value={userPhone} onChange={(e) => setUserPhone(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="modal-user-email">Email</Label>
                <Input id="modal-user-email" name="email" type="email" placeholder="user@company.com" required
                  value={userEmail} onChange={(e) => setUserEmail(e.target.value)} />
              </div>
              {userFormError && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {userFormError}
                </p>
              )}
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isCreatingUser}>
                {isCreatingUser ? "Creating…" : "Create credentials"}
              </Button>
            </DialogFooter>
          </form>
        ); })()}
      </DialogContent>
    </Dialog>
  );
}
