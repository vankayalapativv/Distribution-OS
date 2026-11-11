"use client";

import type { Product } from "./orders-api";
import type { useOrderDraft } from "./use-order-draft";
import { OrderOilLines } from "./order-oil-lines";

type Draft = ReturnType<typeof useOrderDraft>;

/** The order's oil line items (Distribution OS is oils-only). Reads everything it
 *  needs from the shared order-draft state. */
export function OrderLineItemsTabs({
  draft,
  products,
}: Readonly<{
  draft: Draft;
  products: Product[];
}>) {
  return (
    <OrderOilLines
      products={products}
      lineItems={draft.lineItems}
      productSearches={draft.productSearches}
      productPopoverOpen={draft.productPopoverOpen}
      onRegisterSearchInput={draft.registerProductSearchInput}
      onUpdateLineItem={draft.updateLineItem}
      onAddLineItem={draft.addLineItem}
      onRemoveLineItem={draft.removeLineItem}
      onOpenProductPopover={draft.openProductPopover}
      onCloseProductPopover={draft.closeProductPopover}
      onSelectProduct={draft.selectProduct}
      onProductSearchChange={draft.productSearchChange}
    />
  );
}
