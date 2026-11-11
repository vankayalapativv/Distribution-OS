"use client";

import type { ActionConfig } from "@/lib/api-client";
import { ProductDialog, ProductDeleteDialog } from "./product-create-dialog";
import type { ProductsDialogsState } from "./use-products-dialogs";

/** The oils catalogue create/edit + delete dialogs, driven by the dialogs hook. */
export function ProductsDialogs({ d, actionConfig }: Readonly<{ d: ProductsDialogsState; actionConfig: ActionConfig }>) {
  return (
    <>
      <ProductDialog
        open={d.productCreateOpen || d.productEdit !== null}
        editTarget={d.productEdit}
        onOpenChange={(open) => { if (!open) { d.setProductCreateOpen(false); d.setProductEdit(null); } }}
        actionConfig={actionConfig}
      />
      <ProductDeleteDialog
        target={d.productDelete}
        onOpenChange={(open) => { if (!open) d.setProductDelete(null); }}
        actionConfig={actionConfig}
      />
    </>
  );
}
