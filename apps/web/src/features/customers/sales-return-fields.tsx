"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { errorMessage } from "@/lib/api-client";
import { rupeesExact } from "@/lib/format";
import { SalesReturnLines } from "./sales-return-lines";
import { SalesReturnReasonProof } from "./sales-return-reason-proof";
import { SalesReturnInvoicePicker } from "./sales-return-invoice-picker";
import type { ReturnLine } from "./sales-return-edit-logic";
import type { OutstandingInvoice, ReturnableResponse } from "./sales-return-create-logic";

/** The new-return form body: invoice picker + date, the returnable-line editor
 *  (with loading / error / empty states), totals, reason and a proof upload. */
export function SalesReturnFields({
  invoiceId,
  pickInvoice,
  invoicesQ,
  date,
  setDate,
  returnableQ,
  lines,
  qty,
  setQty,
  outstanding,
  total,
  overCap,
  reason,
  setReason,
  proofFile,
  setProofFile,
  error,
}: {
  readonly invoiceId: string;
  readonly pickInvoice: (id: string) => void;
  readonly invoicesQ: UseQueryResult<{ invoices: OutstandingInvoice[] }>;
  readonly date: string;
  readonly setDate: (v: string) => void;
  readonly returnableQ: UseQueryResult<ReturnableResponse>;
  readonly lines: ReturnLine[];
  readonly qty: Record<string, string>;
  readonly setQty: (u: (s: Record<string, string>) => Record<string, string>) => void;
  readonly outstanding: number;
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
      <SalesReturnInvoicePicker
        invoiceId={invoiceId}
        pickInvoice={pickInvoice}
        invoicesQ={invoicesQ}
        date={date}
        setDate={setDate}
      />

      {invoiceId ? (
        (() => { if (returnableQ.isLoading) return (
          <p className="py-4 text-center text-sm text-muted-foreground">Loading invoice lines…</p>
        ); if (returnableQ.isError) return (
          <p className="rounded-md bg-destructive/10 px-3 py-4 text-center text-sm text-destructive">
            Couldn’t load this invoice’s lines. {errorMessage(returnableQ.error, "Please try again.")}
          </p>
        ); return (
          <SalesReturnLines lines={lines} qty={qty} setQty={setQty} />
        ); })()
      ) : null}

      {invoiceId && lines.length > 0 ? (
        <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            Outstanding on invoice: <span className="font-medium text-foreground">{rupeesExact(outstanding)}</span>
          </span>
          <span className={overCap ? "font-semibold text-destructive" : "font-semibold text-foreground"}>
            Return total: {rupeesExact(total)}
          </span>
        </div>
      ) : null}
      {overCap ? (
        <p className="text-xs text-destructive">A return can’t exceed what’s still outstanding — reduce the quantity.</p>
      ) : null}

      <SalesReturnReasonProof
        reason={reason}
        setReason={setReason}
        proofFile={proofFile}
        setProofFile={setProofFile}
        proofLabel="Proof (optional)"
        proofPlaceholder="Attach a document (optional)"
      />

      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
    </>
  );
}
