"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
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
import { COUNT_LABELS, totalCount } from "./reassign-logic";
import type { MovedCounts } from "./reassign-api";

/** Extra-safe confirm: per-type breakdown + an "I understand" checkbox that gates
 *  Confirm. The only confirmation step (replaces the old inline one). */
export function ReassignConfirmDialog({
  open,
  onOpenChange,
  customerName,
  fromName,
  toName,
  counts,
  busy,
  onConfirm,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerName: string;
  fromName: string;
  toName: string;
  counts: MovedCounts;
  busy: boolean;
  onConfirm: () => void;
}>) {
  const [ack, setAck] = useState(false);
  // Reset the acknowledgement in render when the dialog is closed (not an effect).
  if (!open && ack) setAck(false);
  const total = totalCount(counts);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-600" /> Move {customerName}?
          </DialogTitle>
          <DialogDescription>
            All of this customer&apos;s history will be re-attributed to the new sales executive. This affects KPI,
            target and dues credit.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm font-medium">
            {fromName} <ArrowRight className="size-4 text-muted-foreground" /> {toName || "—"}
          </div>
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="flex items-center justify-between bg-muted/60 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <span>Records re-attributed</span>
              <span className="text-foreground">{total} total</span>
            </div>
            {COUNT_LABELS.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between border-t border-border px-3 py-1.5 text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-mono font-medium tabular-nums">{counts[key]}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Note authorship and the weekly beat move too. GPS tracking and logistics delivery history are left as-is.
            You can undo this afterwards.
          </p>
          <label
            className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-3 text-sm ${
              ack ? "border-primary/40 bg-primary/5" : "border-border bg-muted/40"
            }`}
          >
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 size-4 accent-blue-600" />
            <span>
              I understand this moves <strong>{total} records</strong> and re-attributes their history &amp; credit from{" "}
              {fromName} to {toName || "the selected executive"}.
            </span>
          </label>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" disabled={!ack || busy} onClick={onConfirm}>
            {busy ? "Moving…" : "Confirm move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
