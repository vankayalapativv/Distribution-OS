"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/features/orders/search-select";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

/** The Edit-user form body: name / email / phone / status + an error line. */
export function EditUserFields({
  name,
  setName,
  email,
  setEmail,
  phone,
  setPhone,
  status,
  setStatus,
  error,
}: Readonly<{
  name: string;
  setName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  error: string | null;
}>) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="eu-name">Name</Label>
          <Input id="eu-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="eu-email">Email</Label>
          <Input id="eu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="eu-phone">Phone</Label>
          <Input id="eu-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91…" />
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
            Inactive users cannot log in and drop out of assignment lists. Their past records stay intact.
          </p>
        </div>
      </div>
      {error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}
    </>
  );
}
