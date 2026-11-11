"use client";

import { useState } from "react";
import type { ManagedProduct } from "./products-api";

/** Create/edit/delete dialog state for the oils catalogue + the "Add" handler. */
export function useProductsDialogs() {
  const [productCreateOpen, setProductCreateOpen] = useState(false);
  const [productEdit, setProductEdit] = useState<ManagedProduct | null>(null);
  const [productDelete, setProductDelete] = useState<ManagedProduct | null>(null);

  function handleAdd() {
    setProductCreateOpen(true);
  }

  return {
    productCreateOpen, setProductCreateOpen, productEdit, setProductEdit, productDelete, setProductDelete,
    handleAdd,
  };
}

export type ProductsDialogsState = ReturnType<typeof useProductsDialogs>;
