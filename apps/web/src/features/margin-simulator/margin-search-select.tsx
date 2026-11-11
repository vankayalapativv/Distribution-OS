"use client";

import { useMemo, useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { OrderSearchCombobox } from "@/features/orders/order-search-combobox";

export interface PickItem {
  value: string;
  label: string;
  sublabel?: string;
}

/**
 * Click-to-open, type-to-filter picker (the app's shared search combobox) over
 * an in-memory list — used for the Margin Simulator's oil + pack selectors so a
 * long oils list is searchable instead of a tall native dropdown.
 */
export function MarginSearchSelect({
  items,
  value,
  onSelect,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled = false,
  contentClassName = "w-[320px] p-0",
}: {
  readonly items: PickItem[];
  readonly value: string;
  readonly onSelect: (value: string) => void;
  readonly placeholder: string;
  readonly searchPlaceholder: string;
  readonly emptyText: string;
  readonly disabled?: boolean;
  readonly contentClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const q = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      q
        ? items.filter(
            (it) => it.label.toLowerCase().includes(q) || (it.sublabel ?? "").toLowerCase().includes(q),
          )
        : items,
    [items, q],
  );
  const selected = items.find((it) => it.value === value);

  function close() {
    setOpen(false);
    setSearch("");
  }

  if (disabled) {
    return (
      <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
        {placeholder}
      </div>
    );
  }

  return (
    <OrderSearchCombobox
      open={open}
      onOpenChange={(o) => (o ? setOpen(true) : close())}
      triggerLabel={
        <>
          <span className={`truncate ${selected ? "text-foreground" : "text-muted-foreground"}`}>
            {selected?.label ?? placeholder}
          </span>
          <ChevronsUpDown size={14} className="shrink-0 opacity-40" />
        </>
      }
      triggerClassName="h-9"
      contentClassName={contentClassName}
      registerSearchInput={(el) => {
        if (el) requestAnimationFrame(() => el.focus());
      }}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder={searchPlaceholder}
      searchClassName="h-8 text-sm"
      items={filtered}
      getKey={(it) => it.value}
      isSelected={(it) => it.value === value}
      onSelect={(it) => {
        onSelect(it.value);
        close();
      }}
      renderItem={(it) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate">{it.label}</span>
          {it.sublabel ? <span className="truncate text-xs text-muted-foreground">{it.sublabel}</span> : null}
        </span>
      )}
      itemClassName="flex w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
      emptyText={emptyText}
    />
  );
}
