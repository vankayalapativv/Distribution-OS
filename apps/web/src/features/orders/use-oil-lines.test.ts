import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useOilLines } from "./use-oil-lines";
import type { LineItemDraft } from "./orders-create-helpers";

const draft = (over: Partial<LineItemDraft> = {}): LineItemDraft =>
  ({ brand: "", segment: "", productId: "", packSizeLitres: 0, quantityUnits: 1, ...over } as unknown as LineItemDraft);

afterEach(() => vi.useRealTimers());

describe("useOilLines", () => {
  it("seeds one empty line for a new order (incl. an empty initial), and from initial in edit mode", () => {
    expect(renderHook(() => useOilLines(true)).result.current.lineItems).toHaveLength(1);
    expect(renderHook(() => useOilLines(true, [])).result.current.lineItems).toHaveLength(1); // initial.length falsy
    const seeded = renderHook(() => useOilLines(true, [draft({ productId: "p1" }), draft({ productId: "p2" })]));
    expect(seeded.result.current.lineItems).toHaveLength(2);
    expect(seeded.result.current.productSearches).toEqual(["", ""]);
    expect(seeded.result.current.productPopoverOpen).toEqual([false, false]);
  });

  it("reseeds when the dialog opens, and leaves state alone when it closes or is unchanged", () => {
    const { result, rerender } = renderHook(({ o }) => useOilLines(o, [draft({ productId: "p1" })]), { initialProps: { o: false } });
    act(() => result.current.addLineItem());
    expect(result.current.lineItems).toHaveLength(2);
    rerender({ o: false }); // open unchanged → no reseed
    expect(result.current.lineItems).toHaveLength(2);
    rerender({ o: true }); // opened → reseed back to initial (1)
    expect(result.current.lineItems).toHaveLength(1);
    act(() => result.current.addLineItem());
    rerender({ o: false }); // closed → changed but if(open) is false → no reseed
    expect(result.current.lineItems).toHaveLength(2);
  });

  it("adds and removes line items across all parallel arrays", () => {
    const { result } = renderHook(() => useOilLines(true));
    act(() => result.current.addLineItem());
    expect(result.current.lineItems).toHaveLength(2);
    act(() => result.current.removeLineItem(0));
    expect(result.current.lineItems).toHaveLength(1);
    expect(result.current.productSearches).toHaveLength(1);
    expect(result.current.productPopoverOpen).toHaveLength(1);
  });

  it("updateLineItem clears the search for brand/segment, keeps it for other fields", () => {
    const { result } = renderHook(() => useOilLines(true, [draft({ brand: "Fuchs", productId: "p1" })]));
    act(() => result.current.productSearchChange(0, "oil"));
    act(() => result.current.updateLineItem(0, "quantityUnits", 3)); // other field → search kept
    expect(result.current.productSearches[0]).toBe("oil");
    expect(result.current.lineItems[0].quantityUnits).toBe(3);
    act(() => result.current.updateLineItem(0, "brand", "Savsol")); // brand → search cleared + cascade
    expect(result.current.productSearches[0]).toBe("");
    expect(result.current.lineItems[0]).toMatchObject({ brand: "Savsol", productId: "" });
  });

  it("touches only the targeted row, leaving the other rows unchanged", () => {
    const { result } = renderHook(() => useOilLines(true, [draft({ productId: "a" }), draft({ productId: "b" })]));
    act(() => result.current.productSearchChange(0, "keep"));
    act(() => result.current.updateLineItem(1, "segment", "2W")); // segment → clears row 1 search, keeps row 0
    act(() => result.current.updateLineItem(1, "quantityUnits", 9)); // row 0 is the i !== index branch
    act(() => result.current.openProductPopover(1));
    act(() => result.current.selectProduct(1, "b2", "Savsol"));
    expect(result.current.lineItems[0]).toMatchObject({ productId: "a", quantityUnits: 1 });
    expect(result.current.lineItems[1]).toMatchObject({ productId: "b2", segment: "2W", quantityUnits: 9 });
    expect(result.current.productSearches).toEqual(["keep", ""]);
    expect(result.current.productPopoverOpen).toEqual([false, false]); // row 0 untouched; row 1 closed on select
  });

  it("opens the popover and focuses its registered input (null-safe)", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useOilLines(true));
    const input = document.createElement("input");
    const focus = vi.spyOn(input, "focus");
    act(() => result.current.registerProductSearchInput(0, input));
    act(() => result.current.openProductPopover(0));
    expect(result.current.productPopoverOpen[0]).toBe(true);
    act(() => vi.runAllTimers());
    expect(focus).toHaveBeenCalled();
    act(() => result.current.registerProductSearchInput(0, null)); // null ref → no crash
    act(() => { result.current.openProductPopover(0); vi.runAllTimers(); });
    act(() => result.current.closeProductPopover(0));
    expect(result.current.productPopoverOpen[0]).toBe(false);
  });

  it("selectProduct sets the product (+ given brand, else keeps the line's brand) and closes the popover", () => {
    const { result } = renderHook(() => useOilLines(true, [draft({ brand: "Fuchs" })]));
    act(() => result.current.openProductPopover(0));
    act(() => result.current.selectProduct(0, "p9", "Savsol"));
    expect(result.current.lineItems[0]).toMatchObject({ productId: "p9", brand: "Savsol" });
    expect(result.current.productPopoverOpen[0]).toBe(false);
    act(() => result.current.selectProduct(0, "p10")); // no brand → keep existing
    expect(result.current.lineItems[0].brand).toBe("Savsol");
  });
});
