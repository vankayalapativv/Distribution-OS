"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/components/ui/search-select";
import { MODES } from "./ledger-edit-collection-logic";
import { onTypeChange } from "./customer-segment-picker";

/** The collection-edit form body: a verified warning, then amount / date / mode /
 *  reference / remark inputs (all controlled by the parent). */
export function LedgerEditCollectionFields({
  verified,
  amount,
  setAmount,
  date,
  setDate,
  mode,
  setMode,
  reference,
  setReference,
  remark,
  setRemark,
  error,
}: {
  readonly verified: boolean;
  readonly amount: string;
  readonly setAmount: (v: string) => void;
  readonly date: string;
  readonly setDate: (v: string) => void;
  readonly mode: string;
  readonly setMode: (v: string) => void;
  readonly reference: string;
  readonly setReference: (v: string) => void;
  readonly remark: string;
  readonly setRemark: (v: string) => void;
  readonly error: string | null;
}) {
  return (
    <>
      {verified ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-600/20">
          This entry is verified. Saving re-applies it to the customer&apos;s invoices and
          recomputes their outstanding balances.
        </p>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label>Amount (₹) *</Label>
        <Input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          inputMode="decimal"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Date *</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Payment mode *</Label>
          <SearchSelect
            items={MODES}
            valueKey={mode}
            getKey={(m) => m.value}
            getLabel={(m) => m.label}
            onSelect={onTypeChange(setMode)}
            placeholder="Select mode"
            searchPlaceholder="Search mode…"
            emptyText="No match"
            contentClassName="w-[260px] p-0"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Reference no.</Label>
        <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / cheque / txn no." />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Remark</Label>
        <Input value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Optional notes" />
      </div>
      {error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}
    </>
  );
}
