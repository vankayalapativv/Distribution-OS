"use client";

import type { ProductForm } from "./use-product-form";

/** Step-3 summary of the earlier steps, each with an "Edit" jump-back. */
export function WizardReview({ f, onEditStep }: Readonly<{ f: ProductForm; onEditStep: (step: number) => void }>) {
  const row = (label: string, value: string, step: number) => (
    <div className="flex items-baseline gap-3 text-sm">
      <span className="w-20 flex-none text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 font-medium">{value}</span>
      <button type="button" onClick={() => onEditStep(step)} className="flex-none text-xs font-semibold text-primary hover:underline">Edit</button>
    </div>
  );
  const product = `${f.productName || "—"}${f.brand ? ` · ${f.brand}` : ""}${f.hsnCode ? ` · HSN ${f.hsnCode}` : ""}`;
  return (
    <div className="space-y-2.5 rounded-lg border border-border bg-muted/40 px-4 py-3">
      {row("Product", product, 0)}
      {row("Segments", f.segments.join(", ") || "—", 1)}
    </div>
  );
}
