import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useOrderCart } from "./use-order-cart";

describe("useOrderCart", () => {
  it("starts empty with no submittable state", () => {
    const { result } = renderHook(() => useOrderCart());
    expect(result.current.cart).toEqual({});
    expect(result.current.orderedProductIds).toEqual([]);
    expect(result.current.totalLines).toBe(0);
    expect(result.current.totalLitres).toBe(0);
    expect(result.current.cartCount).toBe(0);
    expect(result.current.canSubmit).toBe(false);
    expect(result.current.items).toEqual([]);
  });

  it("adds a product line and derives totals + payload items", () => {
    const { result } = renderHook(() => useOrderCart());
    act(() => result.current.addProductLine("p1", 1, "Car", 2));
    expect(result.current.orderedProductIds).toEqual(["p1"]);
    expect(result.current.totalLines).toBe(1);
    expect(result.current.totalLitres).toBe(2);
    expect(result.current.cartCount).toBe(1);
    expect(result.current.canSubmit).toBe(true);
    expect(result.current.items).toEqual([
      { productId: "p1", quantityUnits: 2, packSizeLitres: 1, segment: "Car" },
    ]);
  });

  it("merges quantity when the same pack+segment is added again", () => {
    const { result } = renderHook(() => useOrderCart());
    act(() => result.current.addProductLine("p1", 1, "Car", 2));
    act(() => result.current.addProductLine("p1", 1, "Car", 3));
    expect(result.current.cart.p1).toHaveLength(1);
    expect(result.current.cart.p1[0].quantityUnits).toBe(5);
  });

  it("keeps separate lines for a different pack or segment", () => {
    const { result } = renderHook(() => useOrderCart());
    act(() => result.current.addProductLine("p1", 1, "Car", 1));
    act(() => result.current.addProductLine("p1", 5, "Car", 1));
    expect(result.current.cart.p1).toHaveLength(2);
    expect(result.current.totalLines).toBe(2);
  });

  it("rounds fractional-pack litres to two decimals", () => {
    const { result } = renderHook(() => useOrderCart());
    act(() => result.current.addProductLine("p1", 0.5, "Car", 3)); // 1.5 L
    act(() => result.current.addProductLine("p2", 0.1, "2W", 2)); // 0.2 L
    expect(result.current.totalLitres).toBe(1.7);
  });

  it("setLineQty updates a line, and a bad value drops it to 0 (not submittable)", () => {
    const { result } = renderHook(() => useOrderCart());
    act(() => result.current.addProductLine("p1", 1, "Car", 2));
    act(() => result.current.setLineQty("p1", 0, "4"));
    expect(result.current.cart.p1[0].quantityUnits).toBe(4);
    act(() => result.current.setLineQty("p1", 0, "abc"));
    expect(result.current.cart.p1[0].quantityUnits).toBe(0);
    expect(result.current.canSubmit).toBe(false);
  });

  it("removeLine drops one line and removes the product key when its last line goes", () => {
    const { result } = renderHook(() => useOrderCart());
    act(() => result.current.addProductLine("p1", 1, "Car", 1));
    act(() => result.current.addProductLine("p1", 5, "Car", 1));
    act(() => result.current.removeLine("p1", 0));
    expect(result.current.cart.p1).toHaveLength(1);
    expect(result.current.cart.p1[0].packSizeLitres).toBe(5);
    act(() => result.current.removeLine("p1", 0));
    expect(result.current.cart.p1).toBeUndefined();
    expect(result.current.orderedProductIds).toEqual([]);
  });

  it("counts a quantity line (null pack) as zero litres", () => {
    const { result } = renderHook(() => useOrderCart());
    act(() => result.current.addProductLine("q1", null, "Car", 3));
    expect(result.current.totalLitres).toBe(0);
    expect(result.current.cartCount).toBe(1);
    expect(result.current.canSubmit).toBe(true);
  });

  it("removeLine on an unknown product id is a no-op", () => {
    const { result } = renderHook(() => useOrderCart());
    act(() => result.current.removeLine("nope", 0));
    expect(result.current.cart).toEqual({});
  });

  it("setLineQty updates only the targeted line", () => {
    const { result } = renderHook(() => useOrderCart());
    act(() => result.current.addProductLine("p1", 1, "Car", 1));
    act(() => result.current.addProductLine("p1", 5, "Car", 1));
    act(() => result.current.setLineQty("p1", 1, "9"));
    expect(result.current.cart.p1[0].quantityUnits).toBe(1);
    expect(result.current.cart.p1[1].quantityUnits).toBe(9);
  });

  it("reset clears the whole cart", () => {
    const { result } = renderHook(() => useOrderCart());
    act(() => result.current.addProductLine("p1", 1, "Car", 1));
    act(() => result.current.reset());
    expect(result.current.cart).toEqual({});
  });
});
