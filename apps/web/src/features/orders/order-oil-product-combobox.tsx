"use client";

import type { Product } from "./orders-api";
import type { LineItemDraft } from "./orders-create-helpers";
import { OrderSearchCombobox } from "./order-search-combobox";

interface OrderOilProductComboboxProps {
  readonly index: number;
  readonly item: LineItemDraft;
  readonly products: Product[];
  readonly search: string;
  readonly popoverOpen: boolean;
  readonly onRegisterSearchInput: (index: number, el: HTMLInputElement | null) => void;
  readonly onOpenProductPopover: (index: number) => void;
  readonly onCloseProductPopover: (index: number) => void;
  readonly onSelectProduct: (index: number, productId: string) => void;
  readonly onProductSearchChange: (index: number, value: string) => void;
}

/** The oil line's product picker: searchable, filtered by the row's segment + query. */
export function OrderOilProductCombobox({
  index,
  item,
  products,
  search,
  popoverOpen,
  onRegisterSearchInput,
  onOpenProductPopover,
  onCloseProductPopover,
  onSelectProduct,
  onProductSearchChange,
}: OrderOilProductComboboxProps) {
  const query = search.toLowerCase();
  const filteredProducts = products.filter((p) => {
    const matchesSeg = !item.segment || p.segments.includes(item.segment);
    const matchesQuery = !query || p.productName.toLowerCase().includes(query);
    return matchesSeg && matchesQuery;
  });

  return (
    <OrderSearchCombobox
      open={popoverOpen}
      onOpenChange={(o) => (o ? onOpenProductPopover(index) : onCloseProductPopover(index))}
      triggerLabel={
        <span className={`truncate ${item.productId ? "text-foreground" : "text-muted-foreground"}`}>
          {item.productId
            ? (products.find((p) => p.id === item.productId)?.productName ?? "Product")
            : "Select product…"}
        </span>
      }
      contentClassName="w-[320px] p-0"
      registerSearchInput={(el) => onRegisterSearchInput(index, el)}
      searchValue={search}
      onSearchChange={(v) => onProductSearchChange(index, v)}
      searchPlaceholder="Search product…"
      searchClassName="h-7 text-sm"
      items={filteredProducts}
      getKey={(p) => p.id}
      isSelected={(p) => item.productId === p.id}
      onSelect={(p) => onSelectProduct(index, p.id)}
      renderItem={(p) => p.productName}
      itemClassName="flex w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
      emptyText={item.segment ? `No products for "${item.segment}"` : "No products found"}
    />
  );
}
