"use client";

import { type SyntheticEvent, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogSection,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type ActionConfig } from "@/lib/api-client";
import { AddProductWizard } from "./add-product-wizard";
import { BrandField } from "./brand-field";
import { ChipToggle, PRODUCT_SEGMENTS } from "./chip-toggle";
import { FieldError, fieldErrorProps } from "./field-error";
import { PackRows } from "./pack-rows";
import { type ProductField, useProductForm } from "./use-product-form";
import type { ManagedProduct } from "./products-api";

/**
 * Add / Edit product — name + brand + HSN + multi-select Segment + Pack Sizes.
 *
 * Adding a NEW product runs the guided 3-step wizard (AddProductWizard); editing
 * an existing one keeps the single-page form below, so an editor can jump straight
 * to the field they want. Both share one `useProductForm` instance.
 */
export function ProductDialog({
  open,
  editTarget,
  onOpenChange,
  actionConfig,
}: {
  readonly open: boolean;
  readonly editTarget: ManagedProduct | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly actionConfig: ActionConfig;
}) {
  const f = useProductForm(open, editTarget, onOpenChange, actionConfig);
  const nameRef = useRef<HTMLInputElement>(null);
  const hsnRef = useRef<HTMLInputElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const segmentsRef = useRef<HTMLDivElement>(null);
  const packsRef = useRef<HTMLDivElement>(null);

  const err = f.fieldErrors;
  const shows = (field: ProductField) => Boolean(f.touched[field] && err[field]);

  function focusField(field: ProductField) {
    requestAnimationFrame(() => {
      if (field === "name") nameRef.current?.focus();
      else if (field === "hsnCode") hsnRef.current?.focus();
      else if (field === "brand") brandRef.current?.querySelector<HTMLElement>("button")?.focus();
      else if (field === "segments") segmentsRef.current?.focus();
      else if (field === "packs") packsRef.current?.focus();
    });
  }

  async function onSubmit(e: SyntheticEvent<HTMLFormElement>) {
    const result = await f.handleSubmit(e);
    if (!result.ok && result.field) focusField(result.field);
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
              <div className="flex flex-col gap-1.5">
                <Label>Product Name <span className="text-destructive">*</span></Label>
                <Input
                  ref={nameRef}
                  value={f.productName}
                  onChange={(e) => { f.setProductName(e.target.value); f.touch("name"); }}
                  onBlur={() => f.touch("name")}
                  placeholder="e.g. Fuchs 10W-40"
                  autoFocus
                  {...fieldErrorProps("edit-err-name", shows("name"), err.name)}
                />
                <FieldError id="edit-err-name" show={shows("name")} message={err.name} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div ref={brandRef} className="flex flex-col gap-1.5">
                  <BrandField
                    category="oils"
                    value={f.brand}
                    onChange={(v) => { f.setBrand(v); f.touch("brand"); }}
                    actionConfig={actionConfig}
                  />
                  <FieldError id="edit-err-brand" show={shows("brand")} message={err.brand} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>HSN Code <span className="text-destructive">*</span></Label>
                  <Input
                    ref={hsnRef}
                    value={f.hsnCode}
                    onChange={(e) => { f.setHsnCode(e.target.value.replace(/[^\d]/g, "")); f.touch("hsnCode"); }}
                    onBlur={() => f.touch("hsnCode")}
                    inputMode="numeric"
                    maxLength={8}
                    placeholder="e.g. 27101980"
                    {...fieldErrorProps("edit-err-hsn", shows("hsnCode"), err.hsnCode)}
                  />
                  <FieldError id="edit-err-hsn" show={shows("hsnCode")} message={err.hsnCode} />
                </div>
              </div>
            </DialogSection>

            <DialogSection label="Classification">
              <div className="flex flex-col gap-1.5">
                <Label>Sold by <span className="text-destructive">*</span></Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => f.setUnit("litres")}
                    className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                      f.unit === "litres"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background text-foreground hover:bg-accent"
                    }`}
                  >
                    Litres (pack sizes)
                  </button>
                  <button
                    type="button"
                    onClick={() => f.setUnit("quantity")}
                    className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                      f.unit === "quantity"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background text-foreground hover:bg-accent"
                    }`}
                  >
                    Quantity (pieces)
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {f.unit === "litres"
                    ? "Oils & lubricants — the executive picks a pack size, then a count."
                    : "Sold by the piece — no pack sizes; the executive just enters a count."}
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Segment <span className="text-destructive">*</span> (pick all that apply)</Label>
                <div
                  ref={segmentsRef}
                  role="group"
                  aria-label="Segment"
                  tabIndex={-1}
                  className="flex flex-wrap gap-2 outline-none"
                  {...fieldErrorProps("edit-err-seg", shows("segments"), err.segments)}
                >
                  {PRODUCT_SEGMENTS.map((s) => (
                    <ChipToggle key={s} label={s} on={f.segments.includes(s)} onClick={() => f.toggleSegment(s)} />
                  ))}
                </div>
                <FieldError id="edit-err-seg" show={shows("segments")} message={err.segments} />
              </div>
            </DialogSection>

            <DialogSection label="Pack sizes">
              {f.unit === "litres" ? (
                <div ref={packsRef} tabIndex={-1} className="flex flex-col gap-1.5 outline-none">
                  <PackRows packs={f.packs} onChange={(p) => { f.setPacks(p); f.touch("packs"); }} />
                  <FieldError id="edit-err-packs" show={shows("packs")} message={err.packs} />
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-input bg-muted/40 px-4 py-5 text-center text-sm text-muted-foreground">
                  Sold <span className="font-medium text-foreground">by the piece</span> — no pack sizes. The executive just enters a count.
                </div>
              )}
            </DialogSection>

            {f.error && (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{f.error}</p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={f.busy || !f.allValid}>
              {f.busy ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
