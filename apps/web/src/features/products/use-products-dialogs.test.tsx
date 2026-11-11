import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useProductsDialogs } from "./use-products-dialogs";
import type { ManagedProduct } from "./products-api";

describe("useProductsDialogs", () => {
  it("opens the create dialog via handleAdd", () => {
    const { result } = renderHook(() => useProductsDialogs());
    act(() => result.current.handleAdd());
    expect(result.current.productCreateOpen).toBe(true);
  });

  it("tracks edit and delete targets", () => {
    const { result } = renderHook(() => useProductsDialogs());
    const p = { id: "p1" } as ManagedProduct;
    act(() => result.current.setProductEdit(p));
    expect(result.current.productEdit).toBe(p);
    act(() => result.current.setProductDelete(p));
    expect(result.current.productDelete).toBe(p);
  });
});
