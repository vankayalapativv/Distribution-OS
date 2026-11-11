"use client";

import { Input } from "@/components/ui/input";
import { SearchSelect } from "@/components/ui/search-select";
import type { Product } from "./orders-api";
import { SEGMENT_OPTIONS, oilLineView, type LineItemDraft } from "./orders-create-helpers";
import { OrderOilProductCombobox } from "./order-oil-product-combobox";
import { OrderRowDelete } from "./order-row-delete";

interface OrderOilLineRowProps {
  readonly index: number;
  readonly item: LineItemDraft;
  readonly products: Product[];
  readonly search: string;
  readonly popoverOpen: boolean;
  readonly onRegisterSearchInput: (index: number, el: HTMLInputElement | null) => void;
  readonly canRemove: boolean;
  readonly onUpdateLineItem: (index: number, field: keyof LineItemDraft, value: string | number) => void;
  readonly onRemoveLineItem: (index: number) => void;
  readonly onOpenProductPopover: (index: number) => void;
  readonly onCloseProductPopover: (index: number) => void;
  readonly onSelectProduct: (index: number, productId: string) => void;
  readonly onProductSearchChange: (index: number, value: string) => void;
}

export function OrderOilLineRow({
  index,
  item,
  products,
  search,
  popoverOpen,
  onRegisterSearchInput,
  canRemove,
  onUpdateLineItem,
  onRemoveLineItem,
  onOpenProductPopover,
  onCloseProductPopover,
  onSelectProduct,
  onProductSearchChange,
}: OrderOilLineRowProps) {
  const { packOptions, lineLitres, isQuantity } = oilLineView(item, products);

  return (
    <div className="grid grid-cols-[2fr_4fr_2fr_72px_32px] gap-2 items-center rounded-lg border border-border bg-muted/20 px-3 py-2.5">
      {/* Segment — app's searchable select (matches the Customer / Executive fields) */}
      <SearchSelect
        items={[{ value: "", label: "Segment" }, ...SEGMENT_OPTIONS]}
        valueKey={item.segment}
        getKey={(o) => o.value}
        getLabel={(o) => o.label}
        onSelect={(v) => onUpdateLineItem(index, "segment", v)}
        placeholder="Segment"
        searchPlaceholder="Search…"
        emptyText="No match"
        triggerClassName="!h-8"
        contentClassName="w-[180px] p-0"
      />

      {/* Product — searchable combobox (segment + query filtered) */}
      <OrderOilProductCombobox
        index={index}
        item={item}
        products={products}
        search={search}
        popoverOpen={popoverOpen}
        onRegisterSearchInput={onRegisterSearchInput}
        onOpenProductPopover={onOpenProductPopover}
        onCloseProductPopover={onCloseProductPopover}
        onSelectProduct={onSelectProduct}
        onProductSearchChange={onProductSearchChange}
      />

      {/* Pack Size — app's searchable select, limited to the selected product's packs.
          Quantity products have no pack size; show a static "By quantity" cell. */}
      {isQuantity ? (
        <div className="flex h-8 items-center rounded-md border border-input bg-muted/40 px-2.5 text-sm text-muted-foreground">
          By quantity
        </div>
      ) : (
        <SearchSelect
          items={
            item.productId
              ? [{ value: "", label: "Size" }, ...packOptions.map((s) => ({ value: String(s), label: `${s} L` }))]
              : [{ value: "", label: "Pick product" }]
          }
          valueKey={item.packSizeLitres > 0 ? String(item.packSizeLitres) : ""}
          getKey={(o) => o.value}
          getLabel={(o) => o.label}
          onSelect={(v) => onUpdateLineItem(index, "packSizeLitres", v ? Number(v) : 0)}
          disabled={!item.productId}
          placeholder="Size"
          searchPlaceholder="Search…"
          emptyText="No match"
          triggerClassName="!h-8"
          contentClassName="w-[160px] p-0"
        />
      )}

      {/* Qty + live total */}
      <div className="flex flex-col items-end gap-0.5">
        <Input
          type="number"
          min={1}
          className="h-8 text-sm bg-background text-right"
          value={item.quantityUnits}
          onChange={(e) => onUpdateLineItem(index, "quantityUnits", Number(e.target.value))}
        />
        {lineLitres !== null && (
          <span className="text-[10px] text-muted-foreground">{lineLitres} L</span>
        )}
      </div>

      <OrderRowDelete canRemove={canRemove} onRemove={() => onRemoveLineItem(index)} />
    </div>
  );
}
