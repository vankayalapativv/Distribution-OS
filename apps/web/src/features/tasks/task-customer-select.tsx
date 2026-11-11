"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/features/orders/search-select";
import type { CustomerLite } from "./tasks-api";

/** Optional customer link — a searchable combobox (name/code/city/exec) + Clear. */
export function TaskCustomerSelect({
  customers, value, onChange, selectedCustomer,
}: {
  readonly customers: CustomerLite[];
  readonly value: string;
  readonly onChange: (id: string) => void;
  readonly selectedCustomer: CustomerLite | null;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>Customer (optional)</Label>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <SearchSelect<CustomerLite>
            items={customers}
            valueKey={value}
            getKey={(c) => c.id}
            // Searchable haystack (kept for search, code not shown in the option/trigger).
            getLabel={(c) => [c.legalName, c.customerCode, c.city, c.salesExecutiveName].filter(Boolean).join(" ")}
            renderOption={(c) => (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-foreground">{c.legalName}</span>
                {c.city || c.salesExecutiveName ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {[c.city, c.salesExecutiveName].filter(Boolean).join(" · ")}
                  </span>
                ) : null}
              </span>
            )}
            renderTrigger={(sel) => (
              <span className={`truncate ${sel ? "text-foreground" : "text-muted-foreground"}`}>
                {sel ? sel.legalName : "No customer linked"}
              </span>
            )}
            onSelect={onChange}
            placeholder="No customer linked"
            searchPlaceholder="Search customers…"
            emptyText="No customers found"
            contentClassName="w-[var(--radix-popover-trigger-width)] max-h-72 overflow-y-auto"
          />
        </div>
        {selectedCustomer && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>Clear</Button>
        )}
      </div>
    </div>
  );
}
