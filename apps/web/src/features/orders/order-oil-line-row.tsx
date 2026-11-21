"use client";

import { SearchSelect } from "@/components/ui/search-select";
import type { Product } from "./orders-api";
import { brandOptions, oilLineView, segmentOptionsForBrand, type LineItemDraft } from "./orders-create-helpers";
import { OrderOilProductCombobox } from "./order-oil-product-combobox";
import { OrderOilPackCell, OrderOilQtyCell } from "./order-oil-line-cells";
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

      {/* Pack Size — product's packs, or a static "By quantity" cell for qty SKUs. */}
      <OrderOilPackCell
        item={item}
        packOptions={packOptions}
        isQuantity={isQuantity}
        onPack={(v) => onUpdateLineItem(index, "packSizeLitres", v ? Number(v) : 0)}
      />

      <OrderOilQtyCell item={item} lineLitres={lineLitres} onQty={(v) => onUpdateLineItem(index, "quantityUnits", v)} />

      <OrderRowDelete canRemove={canRemove} onRemove={() => onRemoveLineItem(index)} />
    </div>
  );
}
