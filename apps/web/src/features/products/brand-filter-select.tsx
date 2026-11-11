"use client";

import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { OrderSearchCombobox } from "@/features/orders/order-search-combobox";
import { ALL_BRANDS } from "./use-catalogue-table";

interface BrandItem {
  value: string;
  label: string;
}

/**
 * Searchable brand switch for the oils catalogue (All brands / Fuchs / Savsol / …).
 * Uses the app's shared combobox so it reads/behaves like the other pickers.
 */
export function BrandFilterSelect({
  brand,
  onChange,
  options,
}: {
  /** Selected brand value, or ALL_BRANDS. */
  readonly brand: string;
  readonly onChange: (value: string) => void;
  readonly options: string[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const q = search.trim().toLowerCase();
  const items: BrandItem[] = [
    { value: ALL_BRANDS, label: "All brands" },
    ...options.map((b) => ({ value: b, label: b })),
  ].filter((it) => !q || it.label.toLowerCase().includes(q));
  const label = brand === ALL_BRANDS ? "All brands" : brand;

  return (
    <div className="w-[200px]">
      <OrderSearchCombobox<BrandItem>
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setSearch("");
        }}
        triggerLabel={
          <>
            <span className="truncate text-foreground">{label}</span>
            <ChevronsUpDown size={14} className="shrink-0 opacity-40" />
          </>
        }
        triggerClassName="h-9 bg-white"
        contentClassName="w-(--anchor-width) p-0"
        registerSearchInput={(el) => {
          if (el) requestAnimationFrame(() => el.focus());
        }}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search brand…"
        searchClassName="h-8 text-sm"
        items={items}
        getKey={(it) => it.value}
        isSelected={(it) => it.value === brand}
        onSelect={(it) => {
          onChange(it.value);
          setOpen(false);
          setSearch("");
        }}
        renderItem={(it) => it.label}
        itemClassName="flex w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
        emptyText="No brands found"
      />
    </div>
  );
}
