"use client";

import { useRef } from "react";
import type { ProductField } from "./product-form-logic";

/** Refs for the add/edit product fields + a helper that focuses one (used to put
 *  the cursor on the offending field after validation; the wizard also jumps to
 *  its step first). Shared by the single-page edit form and the 3-step wizard. */
export function useProductFieldRefs() {
  const nameRef = useRef<HTMLInputElement>(null);
  const hsnRef = useRef<HTMLInputElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const segmentsRef = useRef<HTMLDivElement>(null);
  const packsRef = useRef<HTMLDivElement>(null);

  function focusField(field: ProductField) {
    requestAnimationFrame(() => {
      if (field === "name") nameRef.current?.focus();
      else if (field === "hsnCode") hsnRef.current?.focus();
      else if (field === "brand") brandRef.current?.querySelector<HTMLElement>("button")?.focus();
      else if (field === "segments") segmentsRef.current?.focus();
      else packsRef.current?.focus();
    });
  }

  return { nameRef, hsnRef, brandRef, segmentsRef, packsRef, focusField };
}
