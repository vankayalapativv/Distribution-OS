"use client";

import { Plus } from "lucide-react";
import type { Product } from "./orders-api";
import type { LineItemDraft } from "./orders-create-helpers";
import { OrderOilLineRow } from "./order-oil-line-row";

interface OrderOilLinesProps {
  readonly products: Product[];
  readonly lineItems: LineItemDraft[];
  readonly productSearches: string[];
  readonly productPopoverOpen: boolean[];
  readonly onRegisterSearchInput: (index: number, el: HTMLInputElement | null) => void;
  readonly onUpdateLineItem: (index: number, field: keyof LineItemDraft, value: string | number) => void;
  readonly onAddLineItem: () => void;
  readonly onRemoveLineItem: (index: number) => void;
  readonly onOpenProductPopover: (index: number) => void;
  readonly onCloseProductPopover: (index: number) => void;
  readonly onSelectProduct: (index: number, productId: string) => void;
  readonly onProductSearchChange: (index: number, value: string) => void;
}

export function OrderOilLines({
  products,
  lineItems,
  productSearches,
  productPopoverOpen,
  onRegisterSearchInput,
  onUpdateLineItem,
  onAddLineItem,
  onRemoveLineItem,
  onOpenProductPopover,
  onCloseProductPopover,
  onSelectProduct,
  onProductSearchChange,
}: OrderOilLinesProps) {
  return (
    <>
      {/* Column headers */}
      <div className="grid grid-cols-[2fr_4fr_2fr_72px_32px] gap-2 px-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Segment</span>
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Product</span>
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pack Size</span>
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Qty</span>
        <span />
      </div>

      <div className="flex flex-col gap-1.5">
        {lineItems.map((item, index) => (
          <OrderOilLineRow
            key={item.uid}
            index={index}
            item={item}
            products={products}
            search={productSearches[index] ?? ""}
            popoverOpen={productPopoverOpen[index] ?? false}
            onRegisterSearchInput={onRegisterSearchInput}
            canRemove={lineItems.length > 1}
            onUpdateLineItem={onUpdateLineItem}
            onRemoveLineItem={onRemoveLineItem}
            onOpenProductPopover={onOpenProductPopover}
            onCloseProductPopover={onCloseProductPopover}
            onSelectProduct={onSelectProduct}
            onProductSearchChange={onProductSearchChange}
          />
        ))}
      </div>

      {/* Footer: total + add button */}
      <div className="flex items-center justify-between pt-1 px-1">
        <button
          type="button"
          onClick={onAddLineItem}
          className="flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <Plus size={13} />
          Add item
        </button>
        {lineItems.some((i) => i.packSizeLitres > 0) && (
          <span className="text-xs text-muted-foreground">
            Total:{" "}
            <span className="font-semibold text-foreground">
              {lineItems.reduce(
                (s, i) => s + (i.packSizeLitres > 0 ? i.packSizeLitres * i.quantityUnits : 0),
                0,
              )}{" "}
              L
            </span>
          </span>
        )}
      </div>
    </>
  );
}
