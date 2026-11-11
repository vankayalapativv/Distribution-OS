"use client";

import { DialogSection } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/features/orders/search-select";
import { EXPENDITURE_PAYMENT_MODES } from "./expenditures-api";
import type { FormState } from "./use-expenditure-form";

/** Payment mode + paid-to + the optional "For (person)" link. */
export function ExpenditureFormDetails({
  form,
  set,
  people,
}: {
  readonly form: FormState;
  readonly set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  readonly people: { id: string; name: string }[];
}) {
  return (
    <DialogSection label="Details">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Payment mode</Label>
          <SearchSelect
            items={EXPENDITURE_PAYMENT_MODES}
            valueKey={form.paymentMode}
            getKey={(m) => m.value}
            getLabel={(m) => m.label}
            onSelect={(v) => set("paymentMode", v)}
            placeholder="Optional"
            searchPlaceholder="Search mode…"
            emptyText="No mode found"
            contentClassName="w-(--anchor-width) p-0"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="exp-paidto">Paid to</Label>
          <Input id="exp-paidto" value={form.paidTo} onChange={(e) => set("paidTo", e.target.value)} placeholder="Vendor / payee" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>For (person)</Label>
          <SearchSelect
            items={people}
            valueKey={form.userId}
            getKey={(p) => p.id}
            getLabel={(p) => p.name}
            onSelect={(v) => set("userId", v)}
            placeholder="Optional"
            searchPlaceholder="Search person…"
            emptyText="No people found"
            contentClassName="w-(--anchor-width) p-0"
          />
          <p className="text-xs text-muted-foreground">Who the spend was for — e.g. fuel or food for an SE or driver.</p>
        </div>
      </div>
    </DialogSection>
  );
}
