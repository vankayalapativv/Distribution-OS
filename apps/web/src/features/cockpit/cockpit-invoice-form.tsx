"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Edit invoice setup: the series PREFIX + FINANCIAL YEAR (never the running
 * next-number) and the invoice terms text. Prefix/FY save via `invoice-series`;
 * terms save via `settings` (company_terms). `nextSeq` is shown read-only for
 * context.
 */
export function CockpitInvoiceForm({
  prefix,
  finYear,
  nextSeq,
  terms,
  busy,
  onSave,
}: {
  prefix: string;
  finYear: string;
  nextSeq: number | null;
  terms: string;
  busy?: boolean;
  onSave: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const [pfx, setPfx] = useState(prefix);
  const [fy, setFy] = useState(finYear);
  const [t, setT] = useState(terms);

  async function save() {
    const ok = await onSave({ action: "invoice-series", prefix: pfx, finYear: fy });
    if (ok && t.trim() !== terms.trim()) await onSave({ action: "settings", settings: { company_terms: t } });
  }

  return (
    <div className="rounded-[8px] border border-border p-3.5">
      <div className="mb-2.5 text-[13px] font-bold">Invoice setup</div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label className="text-[11px] text-muted-foreground">Series prefix</Label>
          <Input className="h-8 font-mono text-[13px]" value={pfx} onChange={(e) => setPfx(e.target.value)} disabled={busy} />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-[11px] text-muted-foreground">Financial year</Label>
          <Input className="h-8 font-mono text-[13px]" value={fy} onChange={(e) => setFy(e.target.value)} disabled={busy} />
        </div>
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Next invoice number: <span className="font-mono">{pfx || "—"}{nextSeq ?? "—"}</span> — the running number is not
        editable (so numbering never duplicates or skips).
      </p>
      <div className="mt-2.5 flex flex-col gap-1">
        <Label className="text-[11px] text-muted-foreground">Invoice terms &amp; conditions</Label>
        <Textarea className="min-h-[80px] text-[12.5px]" value={t} onChange={(e) => setT(e.target.value)} disabled={busy} />
      </div>
      <Button className="mt-3" size="sm" onClick={save} disabled={busy || !pfx.trim() || !fy.trim()}>
        {busy ? "Saving…" : "Save invoice setup"}
      </Button>
    </div>
  );
}
