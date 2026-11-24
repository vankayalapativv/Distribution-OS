"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface GodownRow {
  id?: string;
  name: string;
  addressLine?: string | null;
  city?: string | null;
  state: string;
  stateCode: string;
  pincode?: string | null;
  isDefault?: boolean;
}

const FIELDS: Array<{ key: keyof GodownRow; label: string; mono?: boolean }> = [
  { key: "name", label: "Name" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "stateCode", label: "State code", mono: true },
  { key: "addressLine", label: "Address" },
  { key: "pincode", label: "Pincode", mono: true },
];

const EMPTY: GodownRow = { name: "", city: "", state: "", stateCode: "", addressLine: "", pincode: "" };

/** Edit existing godowns and add new ones (no delete). The default godown is
 *  marked and can be edited but not unset here. Saves the whole list at once. */
export function CockpitGodownsForm({
  godowns,
  busy,
  onSave,
}: {
  godowns: GodownRow[];
  busy?: boolean;
  onSave: (payload: Record<string, unknown>) => Promise<boolean> | void;
}) {
  const [rows, setRows] = useState<GodownRow[]>(() => godowns.map((g) => ({ ...g })));
  const set = (i: number, k: keyof GodownRow, v: string) =>
    setRows((p) => p.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  return (
    <div className="rounded-[8px] border border-border p-3.5">
      <div className="mb-2.5 text-[13px] font-bold">Godowns</div>
      <div className="flex flex-col gap-3">
        {rows.map((g, i) => (
          <div key={g.id ?? `new-${i}`} className="rounded-[6px] border border-border/70 bg-secondary/40 p-2.5">
            <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
              Godown {i + 1}
              {g.isDefault ? <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9.5px] text-primary">Default</span> : null}
              {!g.id ? <span className="rounded bg-[oklch(0.62_0.15_150/0.14)] px-1.5 py-0.5 text-[9.5px] text-[oklch(0.5_0.15_150)]">New</span> : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {FIELDS.map((f) => (
                <div key={f.key} className="flex flex-col gap-1">
                  <Label className="text-[10.5px] text-muted-foreground">{f.label}</Label>
                  <Input
                    className={`h-7 text-[12.5px] ${f.mono ? "font-mono" : ""}`}
                    value={(g[f.key] ?? "") as string}
                    onChange={(e) => set(i, f.key, e.target.value)}
                    disabled={busy}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setRows((p) => [...p, { ...EMPTY }])} disabled={busy}>
          + Add godown
        </Button>
        <Button size="sm" onClick={() => onSave({ action: "godowns", godowns: rows })} disabled={busy}>
          {busy ? "Saving…" : "Save godowns"}
        </Button>
      </div>
    </div>
  );
}
