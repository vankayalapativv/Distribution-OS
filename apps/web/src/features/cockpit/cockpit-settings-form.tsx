"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface SettingField {
  key: string;
  label: string;
  mono?: boolean;
  placeholder?: string;
}

/**
 * Edit a whitelisted group of `system_settings` (banking, field-tracking hours,
 * admin designation). Submits every field's current value under `action:settings`.
 */
export function CockpitSettingsForm({
  title,
  fields,
  settings,
  busy,
  onSave,
}: {
  title: string;
  fields: SettingField[];
  settings: Record<string, string>;
  busy?: boolean;
  onSave: (payload: Record<string, unknown>) => Promise<boolean> | void;
}) {
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, settings[f.key] ?? ""])),
  );
  const set = (k: string, v: string) => setVals((p) => ({ ...p, [k]: v }));

  return (
    <div className="rounded-[8px] border border-border p-3.5">
      <div className="mb-2.5 text-[13px] font-bold">{title}</div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.key} className="flex flex-col gap-1">
            <Label className="text-[11px] text-muted-foreground">{f.label}</Label>
            <Input
              className={`h-8 text-[13px] ${f.mono ? "font-mono" : ""}`}
              value={vals[f.key] ?? ""}
              placeholder={f.placeholder}
              onChange={(e) => set(f.key, e.target.value)}
              disabled={busy}
            />
          </div>
        ))}
      </div>
      <Button className="mt-3" size="sm" onClick={() => onSave({ action: "settings", settings: vals })} disabled={busy}>
        {busy ? "Saving…" : `Save ${title.toLowerCase()}`}
      </Button>
    </div>
  );
}
