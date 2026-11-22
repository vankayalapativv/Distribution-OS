"use client";

import { type SyntheticEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogSection, DialogTitle,
} from "@/components/ui/dialog";
import { type ActionConfig } from "@/lib/api-client";
import { AddProductWizard } from "./add-product-wizard";
import { ProductBrandFieldRow, ProductHsnField, ProductNameField } from "./product-core-fields";
import { ProductSegmentsField, ProductUnitToggle } from "./product-class-fields";
import { ProductPacksField } from "./product-packs-field";
import { useProductFieldRefs } from "./use-product-field-refs";
import { useProductForm } from "./use-product-form";
import type { ManagedProduct } from "./products-api";

/**
 * Add / Edit product. Adding runs the guided 3-step wizard (AddProductWizard);
 * editing keeps this single-page form so an editor jumps straight to a field.
 * Both share one `useProductForm` instance and the same field components.
 */
export function ProductDialog({
  open, editTarget, onOpenChange, actionConfig,
}: Readonly<{
  open: boolean;
  editTarget: ManagedProduct | null;
  onOpenChange: (open: boolean) => void;
  actionConfig: ActionConfig;
}>) {
  const f = useProductForm(open, editTarget, onOpenChange, actionConfig);
  const r = useProductFieldRefs();

  async function onSubmit(e: SyntheticEvent<HTMLFormElement>) {
    const result = await f.handleSubmit(e);
    if (!result.ok && result.field) r.focusField(result.field);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        {!editTarget ? (
          <AddProductWizard f={f} onOpenChange={onOpenChange} actionConfig={actionConfig} />
        ) : (
          <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
            <DialogHeader>
              <DialogTitle>Edit product</DialogTitle>
              <DialogDescription>A product in the catalogue.</DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-6">
              <DialogSection label="Product details">
                <ProductNameField f={f} idPrefix="edit-err" inputRef={r.nameRef} autoFocus />
                <div className="grid gap-4 sm:grid-cols-2">
                  <ProductBrandFieldRow f={f} idPrefix="edit-err" wrapRef={r.brandRef} actionConfig={actionConfig} />
                  <ProductHsnField f={f} idPrefix="edit-err" inputRef={r.hsnRef} />
                </div>
              </DialogSection>
              <DialogSection label="Classification">
                <ProductUnitToggle f={f} />
                <ProductSegmentsField f={f} idPrefix="edit-err" segmentsRef={r.segmentsRef} />
              </DialogSection>
              <DialogSection label="Pack sizes">
                <ProductPacksField f={f} idPrefix="edit-err" packsRef={r.packsRef} />
              </DialogSection>
              {f.error && (
                <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{f.error}</p>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={f.busy || !f.allValid}>{f.busy ? "Saving…" : "Save changes"}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
