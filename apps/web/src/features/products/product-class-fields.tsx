"use client";

import { type RefObject } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ChipToggle, PRODUCT_SEGMENTS } from "./chip-toggle";
import { FieldError, fieldErrorProps } from "./field-error";
import type { ProductForm } from "./use-product-form";

/** "Sold by" litres/quantity toggle — shared by the edit form and the wizard. */
export function ProductUnitToggle({ f }: Readonly<{ f: ProductForm }>) {
  const btn = (active: boolean) =>
    cn(
      "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
      active ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background text-foreground hover:bg-accent",
    );
  return (
    <div className="flex flex-col gap-1.5">
      <Label>Sold by <span className="text-destructive">*</span></Label>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => f.setUnit("litres")} className={btn(f.unit === "litres")}>Litres (pack sizes)</button>
        <button type="button" onClick={() => f.setUnit("quantity")} className={btn(f.unit === "quantity")}>Quantity (pieces)</button>
      </div>
      <p className="text-xs text-muted-foreground">
        {f.unit === "litres"
          ? "Oils & lubricants — the executive picks a pack size, then a count."
          : "Sold by the piece — no pack sizes; the executive just enters a count."}
      </p>
    </div>
  );
}

/** Multi-select Segment chips — shared by the edit form and the wizard. */
export function ProductSegmentsField({
  f, idPrefix, segmentsRef,
}: Readonly<{ f: ProductForm; idPrefix: string; segmentsRef: RefObject<HTMLDivElement | null> }>) {
  const show = Boolean(f.touched.segments && f.fieldErrors.segments);
  const id = `${idPrefix}-seg`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label>Segment <span className="text-destructive">*</span> (pick all that apply)</Label>
      <div
        ref={segmentsRef}
        role="group"
        aria-label="Segment"
        tabIndex={-1}
        className="flex flex-wrap gap-2 outline-none"
        {...fieldErrorProps(id, show, f.fieldErrors.segments)}
      >
        {PRODUCT_SEGMENTS.map((s) => (
          <ChipToggle key={s} label={s} on={f.segments.includes(s)} onClick={() => f.toggleSegment(s)} />
        ))}
      </div>
      <FieldError id={id} show={show} message={f.fieldErrors.segments} />
    </div>
  );
}
