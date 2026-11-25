"use client";

import { Label } from "@/components/ui/label";
import { SearchSelect } from "./search-select";
import { OrderDateField } from "./order-date-field";
import {
  CustomerSearchSelect,
  type CustomerOption,
} from "@/features/customers/customer-search-select";
import type { ActionConfig } from "@/lib/api-client";
import type { SalesExecutive } from "./orders-api";

interface OrderHeaderFieldsProps {
  readonly actionConfig: ActionConfig;
  readonly customers: CustomerOption[];
  /** Name of the currently-selected customer (for edit mode display). */
  readonly selectedCustomerLabel?: string | null;
  /** When true, the customer is fixed — shown read-only, not a picker. */
  readonly lockCustomer?: boolean;
  readonly salesExecutives: SalesExecutive[];
  readonly selectedCustomerId: string;
  readonly onCustomerChange: (value: string) => void;
  readonly selectedSalesExecId: string;
  readonly onSalesExecChange: (value: string) => void;
  readonly orderDate: Date | undefined;
  readonly onOrderDateChange: (value: Date | undefined) => void;
  readonly orderDateOpen: boolean;
  readonly onOrderDateOpenChange: (open: boolean) => void;
}

/** The New-Order header row: customer + order date + sales executive. */
export function OrderHeaderFields({
  actionConfig,
  customers,
  selectedCustomerLabel,
  lockCustomer,
  salesExecutives,
  selectedCustomerId,
  onCustomerChange,
  selectedSalesExecId,
  onSalesExecChange,
  orderDate,
  onOrderDateChange,
  orderDateOpen,
  onOrderDateOpenChange,
}: OrderHeaderFieldsProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Customer <span className="text-destructive">*</span>
        </Label>
        {lockCustomer ? (
          <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-foreground">
            <span className="truncate">{selectedCustomerLabel ?? "—"}</span>
          </div>
        ) : (
          <CustomerSearchSelect
            actionConfig={actionConfig}
            seedItems={customers}
            valueKey={selectedCustomerId}
            selectedLabel={selectedCustomerLabel}
            onSelect={onCustomerChange}
          />
        )}
      </div>

      <OrderDateField
        value={orderDate}
        onChange={onOrderDateChange}
        open={orderDateOpen}
        onOpenChange={onOrderDateOpenChange}
      />

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Credit to <span className="text-destructive">*</span>
        </Label>
        <SearchSelect
          items={salesExecutives}
          valueKey={selectedSalesExecId}
          getKey={(s) => s.id}
          getLabel={(s) => s.name}
          onSelect={onSalesExecChange}
          placeholder="Select who it's for"
          searchPlaceholder="Search executive…"
          emptyText="No executives found"
          contentClassName="w-[260px] p-0"
          renderOption={(s) => (
            <span className="flex w-full items-center justify-between gap-2">
              <span className="truncate">{s.name}</span>
              {s.isSuperAdmin ? (
                <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  Super Admin
                </span>
              ) : null}
            </span>
          )}
        />
      </div>
    </div>
  );
}
