"use client";

import { DialogSection } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/features/orders/search-select";
import { DatePicker } from "./expenditure-date-picker";
import type { ExpenditureCategory } from "./expenditures-api";
import type { FormState } from "./use-expenditure-form";

/** Date + amount + grouped category select. */
export function ExpenditureFormSpend({
  form,
  set,
  categories,
}: {
  readonly form: FormState;
  readonly set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  readonly categories: ExpenditureCategory[];
}) {
  const selectedCategory = categories.find((c) => c.id === form.categoryId);
  // Compulsory first, then variable — preserves the old grouped order in a flat list.
  const sortedCategories = [...categories].sort((a, b) => {
    if (a.type === b.type) return 0;
    return a.type === "compulsory" ? -1 : 1;
  });
  return (
    <DialogSection label="Spend">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="exp-date">Date</Label>
          <DatePicker id="exp-date" value={form.expenditureDate} onChange={(v) => set("expenditureDate", v)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="exp-amount">Amount (₹)</Label>
          <Input id="exp-amount" type="number" min="0" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0.00" required />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Category</Label>
          <SearchSelect
            items={sortedCategories}
            valueKey={form.categoryId}
            getKey={(c) => c.id}
            getLabel={(c) => c.name}
            onSelect={(v) => set("categoryId", v)}
            placeholder="Select category"
            searchPlaceholder="Search category…"
            emptyText="No category found"
            contentClassName="max-h-72 w-(--anchor-width) p-0"
            renderOption={(c) => (
              <span className="flex w-full items-center justify-between gap-3">
                <span className="truncate">{c.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {c.type === "compulsory" ? "Compulsory" : "Variable"}
                </span>
              </span>
            )}
          />
          {selectedCategory ? (
            <p className="text-xs text-muted-foreground">
              {selectedCategory.type === "compulsory" ? "Compulsory" : "Variable"} expenditure
            </p>
          ) : null}
        </div>
      </div>
    </DialogSection>
  );
}
