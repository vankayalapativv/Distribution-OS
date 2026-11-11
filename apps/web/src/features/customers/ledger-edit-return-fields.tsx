"use client";

import { ImagePlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { rupeesExact } from "@/lib/format";
import { SalesReturnLines } from "./sales-return-lines";
import type { ReturnLine } from "./sales-return-edit-logic";

/** The return-edit form body: date, the line table, totals, reason and a proof
 *  file input. All values are controlled by the parent hook. */
export function LedgerEditReturnFields({
  date,
  setDate,
  lines,
  qty,
  setQty,
  available,
  total,
  overCap,
  reason,
  setReason,
  proofFile,
  setProofFile,
  error,
}: {
  readonly date: string;
  readonly setDate: (v: string) => void;
  readonly lines: ReturnLine[];
  readonly qty: Record<string, string>;
  readonly setQty: (updater: (s: Record<string, string>) => Record<string, string>) => void;
  readonly available: number;
  readonly total: number;
  readonly overCap: boolean;
  readonly reason: string;
  readonly setReason: (v: string) => void;
  readonly proofFile: File | null;
  readonly setProofFile: (f: File | null) => void;
  readonly error: string | null;
}) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Return Date <span className="text-destructive">*</span>
        </span>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>

      <SalesReturnLines lines={lines} qty={qty} setQty={setQty} />

      {lines.length > 0 ? (
        <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            Available to return: <span className="font-medium text-foreground">{rupeesExact(available)}</span>
          </span>
          <span className={overCap ? "font-semibold text-destructive" : "font-semibold text-foreground"}>
            Return total: {rupeesExact(total)}
          </span>
        </div>
      ) : null}
      {overCap ? (
        <p className="text-xs text-destructive">A return can’t exceed what’s available — reduce the quantity.</p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reason</span>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional — e.g. damaged / wrong product" />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Replace proof (optional)</span>
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-input bg-background px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent">
          <ImagePlus className="size-4 shrink-0" />
          <span className="truncate">{proofFile ? proofFile.name : "Attach a document (keeps current if empty)"}</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
    </>
  );
}
