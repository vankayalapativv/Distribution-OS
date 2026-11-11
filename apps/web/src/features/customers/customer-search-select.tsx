"use client";

import { ChevronsUpDown } from "lucide-react";
import { type ActionConfig } from "@/lib/api-client";
import { OrderSearchCombobox } from "@/features/orders/order-search-combobox";
import { buildMeta, resolveEmptyText, useCustomerSearch } from "./use-customer-search";

export type { CustomerOption } from "./use-customer-search";

/**
 * Customer picker that searches the SERVER as you type (name / trade name /
 * phone), so any customer is findable regardless of how many exist. `seedItems`
 * (the page's already-loaded list) populates the dropdown instantly before the
 * user types; typing then hits `/customers?search=`. `selectedLabel` lets the
 * trigger show the chosen customer's name even when that customer isn't seeded.
 */
export function CustomerSearchSelect({
  actionConfig,
  valueKey,
  onSelect,
  seedItems = [],
  selectedLabel,
  placeholder = "Select customer",
  searchPlaceholder = "Search name, phone or city…",
  emptyText = "No customers found",
  contentClassName = "w-[320px] p-0",
  disabled = false,
}: {
  readonly actionConfig: ActionConfig;
  readonly valueKey: string;
  readonly onSelect: (id: string) => void;
  readonly seedItems?: import("./use-customer-search").CustomerOption[];
  readonly selectedLabel?: string | null;
  readonly placeholder?: string;
  readonly searchPlaceholder?: string;
  readonly emptyText?: string;
  readonly contentClassName?: string;
  /** Lock the picker — the trigger can't be opened (e.g. an invoice tied to an order). */
  readonly disabled?: boolean;
}) {
  const s = useCustomerSearch({ actionConfig, valueKey, seedItems, selectedLabel });

  return (
    <OrderSearchCombobox
      disabled={disabled}
      open={s.open}
      onOpenChange={(o) => (o ? s.setOpen(true) : s.close())}
      triggerLabel={
        <>
          <span className={`truncate ${s.selectedName ? "text-foreground" : "text-muted-foreground"}`}>
            {s.selectedName || placeholder}
          </span>
          <ChevronsUpDown size={14} className="shrink-0 opacity-40" />
        </>
      }
      triggerClassName="h-9"
      contentClassName={contentClassName}
      registerSearchInput={(el) => {
        if (el) requestAnimationFrame(() => el.focus());
      }}
      searchValue={s.search}
      onSearchChange={s.setSearch}
      searchPlaceholder={searchPlaceholder}
      searchClassName="h-8 text-sm"
      items={s.list}
      getKey={(c) => c.id}
      isSelected={(c) => c.id === valueKey}
      onSelect={(c) => {
        s.choose(c);
        onSelect(c.id);
        s.close();
      }}
      renderItem={(c) => {
        const meta = buildMeta(c);
        return (
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{c.legalName}</span>
            {meta ? <span className="truncate text-xs text-muted-foreground">{meta}</span> : null}
          </span>
        );
      }}
      itemClassName="flex w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
      emptyText={resolveEmptyText(s.isFetching, s.debounced.length, seedItems.length, emptyText)}
      loading={s.loading}
    />
  );
}
