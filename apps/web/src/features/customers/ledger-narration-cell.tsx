"use client";

import { FileText } from "lucide-react";
import type { LedgerRow } from "./ledger-types";

function ProofButton({ title, onClick }: { readonly title: string; readonly onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10"
      title={title}
    >
      <FileText className="size-3.5" /> Proof
    </button>
  );
}

/** The Narration cell: text, an optional Proof button (receipt / return), and a
 *  "Needs to verify" badge for unverified receipts. */
export function LedgerNarrationCell({
  row: r,
  canViewProof,
  onOpenProof,
  onOpenReturnProof,
}: {
  readonly row: LedgerRow;
  readonly canViewProof: boolean;
  readonly onOpenProof: (collectionId: string) => void;
  readonly onOpenReturnProof: (returnId: string) => void;
}) {
  const showProof = r.hasProof && canViewProof;
  return (
    <span className="flex flex-col items-start gap-1">
      <span className="inline-flex items-center gap-1.5">
        {r.narration}
        {r.type === "Rcpt" && showProof ? (
          <ProofButton title="View payment receipt" onClick={() => onOpenProof(r.collectionId!)} />
        ) : null}
        {r.type === "Sale_re" && showProof ? (
          <ProofButton title="View return proof" onClick={() => onOpenReturnProof(r.returnId!)} />
        ) : null}
      </span>
      {r.type === "Rcpt" && r.needsVerify ? (
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-600/20">
          Needs to verify
        </span>
      ) : null}
    </span>
  );
}
