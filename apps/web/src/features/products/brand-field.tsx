"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronsUpDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import { apiGet, type ActionConfig } from "@/lib/api-client";
import { OrderSearchCombobox } from "@/features/orders/order-search-combobox";

/** Brand categories map 1:1 to catalogue categories on the API. */
export type BrandCategory = "oils";

/** One row in the brand list: an existing brand, or a "create new" from the query. */
type BrandItem = { kind: "brand" | "create"; value: string };

/**
 * Mandatory Brand field: a searchable pick-or-type combobox backed by the
 * category's brand list. Existing brands filter as you type; a value not in the
 * list surfaces a "Use …" row so new brands can still be added (auto-created on
 * save, server-side). Styled to match the app's other comboboxes.
 */
export function BrandField({
  category,
  value,
  onChange,
  actionConfig,
}: Readonly<{
  category: BrandCategory;
  value: string;
  onChange: (value: string) => void;
  actionConfig: ActionConfig;
}>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data } = useQuery({
    queryKey: ["brands", category],
    queryFn: () => apiGet<{ brands: string[] }>(actionConfig, `/brands?category=${category}`),
  });
  const brands = data?.brands ?? [];

  const typed = search.trim();
  const q = typed.toLowerCase();
  const filtered = q ? brands.filter((b) => b.toLowerCase().includes(q)) : brands;
  const exact = brands.some((b) => b.toLowerCase() === q);
  // Offer a "Use <typed>" row when the query is a new value (pick-or-type).
  const items: BrandItem[] = [
    ...(typed && !exact ? [{ kind: "create" as const, value: typed }] : []),
    ...filtered.map((b) => ({ kind: "brand" as const, value: b })),
  ];

  return (
    <div className="flex flex-col gap-1.5">
      <Label>Brand <span className="text-destructive">*</span></Label>
      <OrderSearchCombobox
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setSearch("");
        }}
        triggerLabel={
          <>
            <span className={`truncate ${value ? "text-foreground" : "text-muted-foreground"}`}>
              {value || "Pick a brand or type a new one"}
            </span>
            <ChevronsUpDown size={14} className="shrink-0 opacity-40" />
          </>
        }
        triggerClassName="h-9"
        contentClassName="w-(--anchor-width) p-0"
        registerSearchInput={(el) => {
          if (el) requestAnimationFrame(() => el.focus());
        }}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search or type a new brand…"
        searchClassName="h-8 text-sm"
        items={items}
        getKey={(it) => `${it.kind}:${it.value}`}
        isSelected={(it) => it.kind === "brand" && it.value === value}
        onSelect={(it) => {
          onChange(it.value);
          setOpen(false);
          setSearch("");
        }}
        renderItem={(it) =>
          it.kind === "create" ? (
            <span>
              Use <span className="font-medium">“{it.value}”</span>
            </span>
          ) : (
            it.value
          )
        }
        itemClassName="flex w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
        emptyText="Type to add a new brand"
      />
    </div>
  );
}
