"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ProfileValues {
  name?: string;
  legalName?: string;
  gstin?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  addressLine1?: string;
  addressLine2?: string | null;
  addressCity?: string;
  addressState?: string;
  addressPincode?: string;
}

const FIELDS: Array<{ key: keyof ProfileValues; label: string; mono?: boolean }> = [
  { key: "name", label: "Trade name" },
  { key: "legalName", label: "Legal name" },
  { key: "gstin", label: "GSTIN", mono: true },
  { key: "contactName", label: "Contact name" },
  { key: "contactPhone", label: "Contact phone", mono: true },
  { key: "contactEmail", label: "Contact email" },
  { key: "addressLine1", label: "Address line 1" },
  { key: "addressLine2", label: "Address line 2" },
  { key: "addressCity", label: "City" },
  { key: "addressState", label: "State" },
  { key: "addressPincode", label: "Pincode", mono: true },
];

/** Edit an enterprise's company & contact profile (onboarding identity fields).
 *  Submits only changed, non-empty values. */
export function CockpitProfileForm({
  initial,
  busy,
  onSave,
}: {
  initial: ProfileValues;
  busy?: boolean;
  onSave: (changed: ProfileValues) => void;
}) {
  const [vals, setVals] = useState<ProfileValues>(() => ({
    ...Object.fromEntries(FIELDS.map((f) => [f.key, (initial[f.key] ?? "") as string])),
  }));
  const set = (k: keyof ProfileValues, v: string) => setVals((p) => ({ ...p, [k]: v }));

  function submit() {
    const changed: ProfileValues = {};
    for (const f of FIELDS) {
      const next = String(vals[f.key] ?? "").trim();
      const was = String(initial[f.key] ?? "").trim();
      if (next !== was) (changed as Record<string, string>)[f.key] = next;
    }
    onSave(changed);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2.5 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key} className="flex flex-col gap-1">
            <Label className="text-[11px] text-muted-foreground">{f.label}</Label>
            <Input
              className={`h-8 text-[13px] ${f.mono ? "font-mono" : ""}`}
              value={(vals[f.key] ?? "") as string}
              onChange={(e) => set(f.key, e.target.value)}
              disabled={busy}
            />
          </div>
        ))}
      </div>
      <Button className="self-start" size="sm" onClick={submit} disabled={busy}>
        {busy ? "Saving…" : "Save company details"}
      </Button>
    </div>
  );
}
