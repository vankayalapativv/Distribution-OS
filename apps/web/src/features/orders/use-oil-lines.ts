"use client";

import { useRef, useState } from "react";
import { emptyLineItem, type LineItemDraft } from "./orders-create-helpers";

/** Owns the oil line-item draft state + handlers. Resets when the dialog opens
 *  — seeded from `initial` in edit mode, or one empty row for a new order. */
export function useOilLines(open: boolean, initial?: LineItemDraft[]) {
  const seed = () => (initial && initial.length ? initial : [emptyLineItem()]);
  const [lineItems, setLineItems] = useState<LineItemDraft[]>(seed);
  const [productSearches, setProductSearches] = useState<string[]>(() => seed().map(() => ""));
  const [productPopoverOpen, setProductPopoverOpen] = useState<boolean[]>(() =>
    seed().map(() => false),
  );
  const productSearchInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [prevOpen, setPrevOpen] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      const s = seed();
      setLineItems(s);
      setProductSearches(s.map(() => ""));
      setProductPopoverOpen(s.map(() => false));
    }
  }

  function addLineItem() {
    setLineItems((prev) => [...prev, emptyLineItem()]);
    setProductSearches((prev) => [...prev, ""]);
    setProductPopoverOpen((prev) => [...prev, false]);
  }

  function removeLineItem(index: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
    setProductSearches((prev) => prev.filter((_, i) => i !== index));
    setProductPopoverOpen((prev) => prev.filter((_, i) => i !== index));
  }

  function updateLineItem(index: number, field: keyof LineItemDraft, value: string | number) {
    setLineItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        // Company is the top of the cascade — changing it clears segment/product/pack.
        if (field === "brand") {
          return { ...item, brand: value as string, segment: "", productId: "", packSizeLitres: 0 };
        }
        // When segment changes, reset product selection
        if (field === "segment") {
          return { ...item, segment: value as string, productId: "", packSizeLitres: 0 };
        }
        // Packs are product-specific — clear a stale pack when the product changes
        if (field === "productId") {
          return { ...item, productId: value as string, packSizeLitres: 0 };
        }
        return { ...item, [field]: value };
      }),
    );
    if (field === "brand" || field === "segment") {
      setProductSearches((prev) => prev.map((s, i) => (i === index ? "" : s)));
    }
  }

  function registerProductSearchInput(index: number, el: HTMLInputElement | null) {
    productSearchInputRefs.current[index] = el;
  }

  function openProductPopover(index: number) {
    setProductPopoverOpen((prev) => prev.map((v, i) => (i === index ? true : v)));
    setTimeout(() => productSearchInputRefs.current[index]?.focus(), 0);
  }

  function closeProductPopover(index: number) {
    setProductPopoverOpen((prev) => prev.map((v, i) => (i === index ? false : v)));
  }

  function selectProduct(index: number, productId: string, brand?: string | null) {
    // Set product + its company in one update (never resets the chosen segment).
    setLineItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, productId, packSizeLitres: 0, brand: brand || item.brand } : item,
      ),
    );
    closeProductPopover(index);
  }

  function productSearchChange(index: number, value: string) {
    setProductSearches((prev) => prev.map((s, i) => (i === index ? value : s)));
  }

  return {
    lineItems,
    productSearches,
    productPopoverOpen,
    registerProductSearchInput,
    addLineItem,
    removeLineItem,
    updateLineItem,
    openProductPopover,
    closeProductPopover,
    selectProduct,
    productSearchChange,
  };
}
