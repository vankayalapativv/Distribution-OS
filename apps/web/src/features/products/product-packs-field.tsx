"use client";

import { type RefObject } from "react";
import { FieldError } from "./field-error";
import { PackRows } from "./pack-rows";
import type { ProductForm } from "./use-product-form";

/** Pack-sizes editor for a litres product, or the "by the piece" note for a
 *  quantity product. Parents wrap it in a `<DialogSection label="Pack sizes">`. */
export function ProductPacksField({
  f, idPrefix, packsRef,
}: Readonly<{ f: ProductForm; idPrefix: string; packsRef: RefObject<HTMLDivElement | null> }>) {
  if (f.unit !== "litres") {
    return (
      <div className="rounded-lg border border-dashed border-input bg-muted/40 px-4 py-5 text-center text-sm text-muted-foreground">
        Sold <span className="font-medium text-foreground">by the piece</span> — no pack sizes. The executive just enters a count.
      </div>
    );
  }
  const show = Boolean(f.touched.packs && f.fieldErrors.packs);
  return (
    <div ref={packsRef} tabIndex={-1} className="flex flex-col gap-1.5 outline-none">
      <PackRows packs={f.packs} onChange={(p) => { f.setPacks(p); f.touch("packs"); }} />
      <FieldError id={`${idPrefix}-packs`} show={show} message={f.fieldErrors.packs} />
    </div>
  );
}
