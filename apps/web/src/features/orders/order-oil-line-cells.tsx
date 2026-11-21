"use client";

import { Input } from "@/components/ui/input";
import { SearchSelect } from "@/components/ui/search-select";
import type { LineItemDraft } from "./orders-create-helpers";

/** Pack-size cell: a searchable select of the product's packs, a "Pick product"
 *  placeholder until one is chosen, or a static "By quantity" cell for qty SKUs. */
export function OrderOilPackCell({
  item, packOptions, isQuantity, onPack,
}: Readonly<{
  item: LineItemDraft;
  packOptions: number[];
  isQuantity: boolean;
  onPack: (value: string) => void;
}>) {
  if (isQuantity) {
    return (
      <div className="flex h-8 items-center rounded-md border border-input bg-muted/40 px-2.5 text-sm text-muted-foreground">
        By quantity
      </div>
    );
  }
  return (
    <SearchSelect
      items={
        item.productId
          ? [{ value: "", label: "Size" }, ...packOptions.map((s) => ({ value: String(s), label: `${s} L` }))]
          : [{ value: "", label: "Pick product" }]
      }
      valueKey={item.packSizeLitres > 0 ? String(item.packSizeLitres) : ""}
      getKey={(o) => o.value}
      getLabel={(o) => o.label}
      onSelect={onPack}
      disabled={!item.productId}
      placeholder="Size"
      searchPlaceholder="Search…"
      emptyText="No match"
      triggerClassName="!h-8"
      contentClassName="w-[160px] p-0"
    />
  );
}

/** Qty cell: live line litres inline to the LEFT of the quantity input, so the
 *  row height matches the dropdowns. */
export function OrderOilQtyCell({
  item, lineLitres, onQty,
}: Readonly<{
  item: LineItemDraft;
  lineLitres: number | null;
  onQty: (value: number) => void;
}>) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      {lineLitres !== null && (
        <span className="whitespace-nowrap text-[10px] text-muted-foreground">{lineLitres} L</span>
      )}
      <Input
        type="number"
        min={1}
        className="h-8 w-14 text-sm bg-background text-right"
        value={item.quantityUnits}
        onChange={(e) => onQty(Number(e.target.value))}
      />
    </div>
  );
}
