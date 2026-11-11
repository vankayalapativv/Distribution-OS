"use client";

import { Input } from "@/components/ui/input";
import { SearchSelect } from "@/components/ui/search-select";
import type { Product } from "./orders-api";
import { brandOptions, oilLineView, segmentOptionsForBrand, type LineItemDraft } from "./orders-create-helpers";
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
  const brands = brandOptions(products);
  const segmentItems = segmentOptionsForBrand(products, item.brand);

  return (
    <div className="grid grid-cols-[1.6fr_1.6fr_3fr_1.6fr_112px_32px] gap-2 items-center rounded-lg border border-border bg-muted/20 px-3 py-2.5">
      {/* Company (brand) — first cascade step: Company → Segment → SKU → Pack */}
      <SearchSelect
        items={[{ value: "", label: "Company" }, ...brands.map((b) => ({ value: b, label: b }))]}
        valueKey={item.brand}
        getKey={(o) => o.value}
        getLabel={(o) => o.label}
        onSelect={(v) => onUpdateLineItem(index, "brand", v)}
        placeholder="Company"
        searchPlaceholder="Search…"
        emptyText="No match"
        triggerClassName="!h-8"
        contentClassName="w-[180px] p-0"
      />

      {/* Segment — filtered to the chosen company's segments */}
      <SearchSelect
        items={[{ value: "", label: "Segment" }, ...segmentItems]}
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

      {/* Qty + live total — litres sit inline to the LEFT of the input so the row
          height matches the dropdowns (no dangling line below the box). */}
      <div className="flex items-center justify-end gap-1.5">
        {lineLitres !== null && (
          <span className="whitespace-nowrap text-[10px] text-muted-foreground">{lineLitres} L</span>
        )}
        <Input
          type="number"
          min={1}
          className="h-8 w-14 text-sm bg-background text-right"
          value={item.quantityUnits}
          onChange={(e) => onUpdateLineItem(index, "quantityUnits", Number(e.target.value))}
        />
      </div>

      <OrderRowDelete canRemove={canRemove} onRemove={() => onRemoveLineItem(index)} />
    </div>
  );
}
