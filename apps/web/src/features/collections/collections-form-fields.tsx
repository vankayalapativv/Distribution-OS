"use client";

import { Input } from "@/components/ui/input";
import { SearchSelect } from "@/features/orders/search-select";
import { CustomerSearchSelect, type CustomerOption } from "@/features/customers/customer-search-select";
import type { ActionConfig } from "@/lib/api-client";
import type { Collector } from "./collections-types";
import { FieldLabel } from "./collection-field-label";
import { ProofPicker } from "./collection-proof-picker";
import { CollectionPaymentFields } from "./collection-payment-fields";
import type { CollectionForm } from "./collection-form-types";

export { EMPTY_COLLECTION_FORM } from "./collection-form-types";
export type { CollectionForm } from "./collection-form-types";

/** The full "record a collection" form body (customer, collector, payment,
 *  proof, remarks). Presentational — the parent owns `form`/`proofFile` state. */
export function CollectionFormFields({
  form, setForm, customers, collectors, proofFile, onProofChange, actionConfig, lockedCustomerLabel,
}: {
  readonly form: CollectionForm;
  readonly setForm: React.Dispatch<React.SetStateAction<CollectionForm>>;
  readonly customers: CustomerOption[];
  readonly collectors: Collector[];
  readonly proofFile: File | null;
  readonly onProofChange: (file: File | null) => void;
  readonly actionConfig: ActionConfig;
  /** When set, the customer is fixed (e.g. from a customer's ledger): show a
   *  read-only field instead of the searchable picker. */
  readonly lockedCustomerLabel?: string;
}) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <FieldLabel required>Customer</FieldLabel>
        {lockedCustomerLabel ? (
          <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
            {lockedCustomerLabel}
          </div>
        ) : (
          <CustomerSearchSelect
            actionConfig={actionConfig}
            seedItems={customers}
            valueKey={form.customerId}
            onSelect={(id) => setForm((prev) => ({ ...prev, customerId: id }))}
          />
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel required>Collected By</FieldLabel>
        <SearchSelect
          items={collectors}
          valueKey={form.collectedByUserId}
          getKey={(u) => u.id}
          getLabel={(u) => u.name}
          onSelect={(id) => setForm((prev) => ({ ...prev, collectedByUserId: id }))}
          placeholder="Select who collected"
          searchPlaceholder="Search staff…"
          emptyText="No users found"
          contentClassName="w-[320px] p-0"
          renderOption={(u) => (
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{u.name}</span>
              {u.roleLabel ? <span className="truncate text-xs text-muted-foreground">{u.roleLabel}</span> : null}
            </span>
          )}
        />
      </div>

      <CollectionPaymentFields form={form} setForm={setForm} />
      <ProofPicker file={proofFile} onChange={onProofChange} />

      <div className="flex flex-col gap-1.5">
        <FieldLabel>Remarks</FieldLabel>
        <Input
          value={form.remarks}
          onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))}
          placeholder="Optional notes"
        />
      </div>
    </>
  );
}
