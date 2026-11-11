"use client";

import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { LedgerNarrationCell } from "./ledger-narration-cell";
import { amt, balanceLabel, fmtDate, payoffLabel, type LedgerRow } from "./ledger-types";

export interface LedgerRowHandlers {
  onOpenInvoice: (invoiceId: string) => void;
  onOpenProof: (collectionId: string) => void;
  onOpenReturnProof: (returnId: string) => void;
  onEdit: (row: LedgerRow) => void;
}

const PAYOFF_TONE = {
  unpaid: "font-medium text-red-600",
  partial: "font-medium text-amber-700",
  paid: "text-muted-foreground",
} as const;

/** True when a row is editable (has the id its type needs). Sale (invoice) rows
 *  are not editable from the ledger — a generated invoice is edited on its own
 *  page; the Sale row still links to its PDF. */
export function isEditable(r: LedgerRow): boolean {
  return (
    (r.type === "Rcpt" && !!r.collectionId) ||
    (r.type === "Sale_re" && !!r.returnId)
  );
}

/** One ledger transaction row. */
export function LedgerTableRow({
  row: r,
  canViewProof,
  canEditEntries,
  handlers,
}: {
  readonly row: LedgerRow;
  readonly canViewProof: boolean;
  readonly canEditEntries: boolean;
  readonly handlers: LedgerRowHandlers;
}) {
  const p = payoffLabel(r);
  return (
    <tr className="group border-b border-border last:border-0 hover:bg-muted/20">
      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{fmtDate(r.date)}</td>
      <td className="px-3 py-2.5">{r.type}</td>
      <td className="px-3 py-2.5">
        {(r.type === "Sale" || r.type === "Sale_re") && r.invoiceId ? (
          <button
            type="button"
            onClick={() => handlers.onOpenInvoice(r.invoiceId!)}
            className="font-mono text-xs font-semibold text-primary hover:underline"
            title="Open invoice PDF"
          >
            {r.vchNo}
          </button>
        ) : (
          <span className="font-mono text-xs text-muted-foreground">{r.vchNo ?? "—"}</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-muted-foreground">{r.particulars}</td>
      <td className="px-3 py-2.5">
        <LedgerNarrationCell
          row={r}
          canViewProof={canViewProof}
          onOpenProof={handlers.onOpenProof}
          onOpenReturnProof={handlers.onOpenReturnProof}
        />
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums">{r.debit != null ? amt(r.debit) : ""}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{r.credit != null ? amt(r.credit) : ""}</td>
      <td className={cn("px-3 py-2.5 text-right font-medium tabular-nums", r.balance < 0 && "text-green-700")}>
        {balanceLabel(r.balance)}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs tabular-nums">
        {p ? <span className={PAYOFF_TONE[p.tone]}>{p.text}</span> : null}
      </td>
      <td className="px-2 py-2.5 text-right">
        {canEditEntries && isEditable(r) ? (
          <button
            type="button"
            onClick={() => handlers.onEdit(r)}
            className="inline-flex items-center rounded p-1 text-muted-foreground/60 transition hover:bg-accent hover:text-foreground group-hover:text-muted-foreground"
            title="Edit this entry"
            aria-label="Edit entry"
          >
            <Pencil className="size-3.5" />
          </button>
        ) : null}
      </td>
    </tr>
  );
}
