"use client";

import { ImagePlus } from "lucide-react";
import { Input } from "@/components/ui/input";

/** Shared Reason input + proof-file upload for the sales-return dialogs. */
export function SalesReturnReasonProof({
  reason,
  setReason,
  proofFile,
  setProofFile,
  proofLabel,
  proofPlaceholder,
}: {
  readonly reason: string;
  readonly setReason: (v: string) => void;
  readonly proofFile: File | null;
  readonly setProofFile: (f: File | null) => void;
  readonly proofLabel: string;
  readonly proofPlaceholder: string;
}) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reason</span>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional — e.g. damaged / wrong product" />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{proofLabel}</span>
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-input bg-background px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent">
          <ImagePlus className="size-4 shrink-0" />
          <span className="truncate">{proofFile ? proofFile.name : proofPlaceholder}</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
    </>
  );
}
