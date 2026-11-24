"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface DuesBandRow {
  ordinal: number;
  fromDays: number;
  toDays: number | null;
  label: string;
}

/** Edit the 4 collection-dues bands' day ranges + labels (the count stays 4; the
 *  top band's "to" is open-ended). Saves all four at once in ordinal order. */
export function CockpitDuesForm({
  bands,
  busy,
  onSave,
}: {
  bands: DuesBandRow[];
  busy?: boolean;
  onSave: (payload: Record<string, unknown>) => Promise<boolean> | void;
}) {
  const [rows, setRows] = useState<DuesBandRow[]>(() => bands.map((b) => ({ ...b })));
  const set = (i: number, k: keyof DuesBandRow, v: string) =>
    setRows((p) =>
      p.map((r, j) =>
        j === i ? { ...r, [k]: k === "label" ? v : v === "" ? (k === "toDays" ? null : 0) : Number(v) } : r,
      ),
    );

  const lastIdx = rows.length - 1;

  return (
    <div className="rounded-[8px] border border-border p-3.5">
      <div className="mb-2.5 text-[13px] font-bold">Collection dues bands</div>
      <div className="flex flex-col gap-2">
        {rows.map((b, i) => (
          <div key={b.ordinal} className="grid grid-cols-[1fr_auto_auto] items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-[10.5px] text-muted-foreground">Label</Label>
              <Input className="h-7 text-[12.5px]" value={b.label} onChange={(e) => set(i, "label", e.target.value)} disabled={busy} />
            </div>
            <div className="flex w-20 flex-col gap-1">
              <Label className="text-[10.5px] text-muted-foreground">From (days)</Label>
              <Input className="h-7 font-mono text-[12.5px]" inputMode="numeric" value={String(b.fromDays)} onChange={(e) => set(i, "fromDays", e.target.value)} disabled={busy} />
            </div>
            <div className="flex w-20 flex-col gap-1">
              <Label className="text-[10.5px] text-muted-foreground">To (days)</Label>
              <Input
                className="h-7 font-mono text-[12.5px]"
                inputMode="numeric"
                placeholder={i === lastIdx ? "∞" : ""}
                value={b.toDays == null ? "" : String(b.toDays)}
                onChange={(e) => set(i, "toDays", e.target.value)}
                disabled={busy || i === lastIdx}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Bands must stay in ascending, non-overlapping order; the last band is open-ended.</p>
      <Button className="mt-2.5" size="sm" onClick={() => onSave({ action: "dues-bands", bands: rows })} disabled={busy}>
        {busy ? "Saving…" : "Save dues bands"}
      </Button>
    </div>
  );
}
