"use client";

import { Input } from "@/components/ui/input";
import { SearchSelect } from "@/components/ui/search-select";
import { DatePicker } from "@/features/expenditures/expenditure-date-picker";
import { FieldLabel } from "./collection-field-label";
import { PAYMENT_MODES, type CollectionForm } from "./collection-form-types";

type SetForm = React.Dispatch<React.SetStateAction<CollectionForm>>;

/** Date / mode / amount / reference (+ cheque date & bank when mode = cheque). */
export function CollectionPaymentFields({ form, setForm }: { readonly form: CollectionForm; readonly setForm: SetForm }) {
  const set = (patch: Partial<CollectionForm>) => setForm((prev) => ({ ...prev, ...patch }));
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <FieldLabel required>Collection Date</FieldLabel>
          <DatePicker value={form.collectionDate} onChange={(v) => set({ collectionDate: v })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel required>Payment Mode</FieldLabel>
          <SearchSelect
            items={PAYMENT_MODES}
            valueKey={form.paymentMode}
            getKey={(m) => m.value}
            getLabel={(m) => m.label}
            onSelect={(v) => set({ paymentMode: v })}
            placeholder="Select mode"
            searchPlaceholder="Search mode…"
            emptyText="No match"
            contentClassName="w-[220px] p-0"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <FieldLabel required>Amount (₹)</FieldLabel>
          <Input type="number" min="0.01" step="0.01" value={form.collectionAmount}
            onChange={(e) => set({ collectionAmount: e.target.value })} placeholder="0.00" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Reference No</FieldLabel>
          <Input value={form.paymentReferenceNumber}
            onChange={(e) => set({ paymentReferenceNumber: e.target.value })} placeholder="UTR / cheque / txn no." />
        </div>
      </div>

      {form.paymentMode === "cheque" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Cheque Date</FieldLabel>
            <DatePicker value={form.chequeDate} onChange={(v) => set({ chequeDate: v })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Bank Name</FieldLabel>
            <Input value={form.bankName} onChange={(e) => set({ bankName: e.target.value })} placeholder="e.g. SBI" />
          </div>
        </div>
      )}
    </>
  );
}
