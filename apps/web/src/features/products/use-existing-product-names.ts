"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet, type ActionConfig } from "@/lib/api-client";
import type { ManagedProduct } from "./products-api";
import { normalizeProductName } from "./product-form-logic";

/**
 * Normalized catalogue names (minus the product being edited) for the live
 * duplicate-name warning. Reuses the cached full-catalogue read; a failure just
 * disables the hint (the server's 409 on save is the real guard).
 */
export function useExistingProductNames(
  open: boolean,
  editTarget: ManagedProduct | null,
  actionConfig: ActionConfig,
): ReadonlySet<string> {
  const { data } = useQuery({
    queryKey: ["products", "catalogue-names"],
    queryFn: () => apiGet<{ products: Pick<ManagedProduct, "id" | "productName">[] }>(actionConfig, "/products"),
    enabled: open,
    staleTime: 60_000,
  });
  return useMemo(() => {
    const set = new Set<string>();
    const self = editTarget ? normalizeProductName(editTarget.productName) : null;
    for (const p of data?.products ?? []) {
      const n = normalizeProductName(p.productName);
      if (n && n !== self) set.add(n);
    }
    return set;
  }, [data, editTarget]);
}
