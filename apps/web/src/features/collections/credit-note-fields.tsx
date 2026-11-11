"use client";

import { type ReactNode } from "react";
import { ImagePlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { rupeesExact } from "@/lib/format";
import { SearchSelect } from "@/features/orders/search-select";
import { FieldLabel } from "./collection-field-label";
import type { Collector } from "./collections-types";
import type { CreditNoteForm } from "./credit-note-payload";
import type { OutstandingInvoice } from "./use-credit-note";

const Field = ({ label, required, children }: { readonly label: string; readonly required?: boolean; readonly children: ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <FieldLabel required={required}>{label}</FieldLabel>
    {children}
  </div>
);

interface Props {
  readonly form: CreditNoteForm;
  readonly set: (patch: Partial<CreditNoteForm>) => void;
  readonly proofFile: File | null;
  readonly setProofFile: (f: File | null) => void;
  readonly collectors: Collector[];
  readonly invoices: OutstandingInvoice[];
  readonly invoicesLoading: boolean;
}

/** The credit-note form body: issuer, date/amount, invoice, reference/remarks, doc. */
function invoicePlaceholder(loading: boolean, hasInvoices: boolean): string {
  if (loading) return "Loading invoices…";
  return hasInvoices ? "Select an invoice" : "No outstanding invoices";
}

export function CreditNoteFields({ form, set, proofFile, setProofFile, collectors, invoices, invoicesLoading }: Props) {
  return (
    <>
      <Field label="Issued By" required>
        <SearchSelect
          items={collectors} valueKey={form.collectedByUserId} getKey={(u) => u.id} getLabel={(u) => u.name}
          onSelect={(id) => set({ collectedByUserId: id })}
          placeholder="Select who issued it" searchPlaceholder="Search staff…" emptyText="No users found"
          contentClassName="w-[320px] p-0"
          renderOption={(u) => (
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{u.name}</span>
              {u.roleLabel ? <span className="truncate text-xs text-muted-foreground">{u.roleLabel}</span> : null}
            </span>
          )}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" required>
          <Input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} required />
        </Field>
        <Field label="Amount (₹)" required>
          <Input type="number" min="0.01" step="0.01" value={form.amount}
            onChange={(e) => set({ amount: e.target.value })} placeholder="0.00" required />
        </Field>
      </div>

      <Field label="Against Invoice" required>
        <SearchSelect
          items={invoices} valueKey={form.invoiceId} getKey={(i) => i.id}
          getLabel={(i) => `${i.invoiceNumber} · ${rupeesExact(i.outstandingAmount)} due`}
          onSelect={(id) => set({ invoiceId: id })}
          placeholder={invoicePlaceholder(invoicesLoading, invoices.length > 0)}
          searchPlaceholder="Search invoice no…" emptyText="No outstanding invoices" contentClassName="w-[340px] p-0"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Reference No">
          <Input value={form.referenceNo} onChange={(e) => set({ referenceNo: e.target.value })} placeholder="Credit note no." />
        </Field>
        <Field label="Remarks">
          <Input value={form.remarks} onChange={(e) => set({ remarks: e.target.value })} placeholder="Optional" />
        </Field>
      </div>

      <Field label="Document (optional)">
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-input bg-background px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent">
          <ImagePlus className="size-4 shrink-0" />
          <span className="truncate">{proofFile ? proofFile.name : "Attach a document (optional)"}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
            onChange={(e) => setProofFile(e.target.files?.[0] ?? null)} />
        </label>
      </Field>
    </>
  );
}
