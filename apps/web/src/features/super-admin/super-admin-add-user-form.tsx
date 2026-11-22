"use client";

import { type SyntheticEvent } from "react";
import { Button } from "@/components/ui/button";
import { DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/components/ui/search-select";

const ROLE_OPTIONS = [
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "MANAGER", label: "Manager" },
  { value: "ACCOUNTANT", label: "Accountant" },
  { value: "SALES_EXECUTIVE", label: "Sales Executive" },
  { value: "LOGISTICS", label: "Logistics" },
];

/** The Add-user form: role + name/phone/email + error + footer. */
export function AddUserForm({
  role,
  setRole,
  name,
  setName,
  phone,
  setPhone,
  email,
  setEmail,
  error,
  busy,
  onSubmit,
  onCancel,
}: Readonly<{
  role: string;
  setRole: (v: string) => void;
  name: string;
  setName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  error: string | null;
  busy: boolean;
  onSubmit: (e: SyntheticEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}>) {
  return (
    <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
      <DialogBody className="space-y-4">
        <div className="grid gap-1.5">
          <Label>Role</Label>
          <SearchSelect
            items={ROLE_OPTIONS}
            valueKey={role}
            getKey={(r) => r.value}
            getLabel={(r) => r.label}
            onSelect={(v) => { if (v) setRole(v); }}
            placeholder="Select a role"
            searchPlaceholder="Search role…"
            emptyText="No role found"
            contentClassName="w-[320px] p-0"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="modal-user-name">Name</Label>
          <Input id="modal-user-name" name="name" placeholder="Full name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="modal-user-phone">Phone</Label>
          <Input id="modal-user-phone" name="phone" type="tel" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="modal-user-email">Email</Label>
          <Input id="modal-user-email" name="email" type="email" placeholder="user@company.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" type="button" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create credentials"}</Button>
      </DialogFooter>
    </form>
  );
}
