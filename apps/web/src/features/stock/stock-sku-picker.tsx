"use client";

import { useQuery } from "@tanstack/react-query";
import { SearchSelect } from "@/features/orders/search-select";
import type { ActionConfig } from "@/lib/api-client";
import { fetchSkus, packLabel, type Sku } from "./stock-api";

const keyOf = (s: Sku) => `${s.productId}|${s.packSizeLitres}`;

/** Catalogue (product × pack) picker built on the app's shared SearchSelect
 *  combobox. Acts as an "add a line" control: picking calls `onPick` and the
 *  trigger stays on its placeholder. Already-added SKUs are excluded. */
export function SkuPicker({
  actionConfig,
  onPick,
  excludeKeys,
  placeholder = "Add a line — search a product…",
  brand = null,
  disabled = false,
  disabledHint,
}: Readonly<{
  actionConfig: ActionConfig;
  onPick: (sku: Sku) => void;
  excludeKeys: Set<string>;
  placeholder?: string;
  /** When set, only this brand's SKUs are offered (e.g. the chosen stock-in supplier). */
  brand?: string | null;
  /** Gate the picker until a prerequisite (like a supplier brand) is chosen. */
  disabled?: boolean;
  disabledHint?: string;
}>) {
  const { data: skus = [], isLoading } = useQuery({
    queryKey: ["stock-skus-all"],
    queryFn: () => fetchSkus(actionConfig, ""),
    staleTime: 60_000,
  });
  const items = skus.filter((s) => !excludeKeys.has(keyOf(s)) && (!brand || s.brand === brand));

  // Gated (no supplier yet) or still loading the catalogue → a disabled control
  // with the matching label, rather than an empty/openable picker.
  if (disabled || isLoading) {
    return (
      <div className="flex h-10 items-center gap-2 rounded-md border border-dashed border-border bg-muted/40 px-3 text-sm text-muted-foreground">
        {disabled ? (disabledHint ?? placeholder) : "Loading products…"}
      </div>
    );
  }

  return (
    <SearchSelect<Sku>
      items={items}
      valueKey=""
      getKey={keyOf}
      getLabel={(s) => s.productName}
      onSelect={(key) => {
        const sku = skus.find((s) => keyOf(s) === key);
        if (sku) onPick(sku);
      }}
      placeholder={placeholder}
      searchPlaceholder="Search a product…"
      emptyText="No products found"
      contentClassName="w-[380px] p-0"
      renderOption={(s) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate">{s.productName}</span>
          <span className="truncate text-xs text-muted-foreground">
            {packLabel(s.packSizeLitres, s.unit)}{s.brand ? ` · ${s.brand}` : ""}{s.segment ? ` · ${s.segment}` : ""}
          </span>
        </span>
      )}
    />
  );
}
