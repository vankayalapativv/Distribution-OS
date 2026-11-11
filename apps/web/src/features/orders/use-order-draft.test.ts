import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LineItemDraft } from "./orders-create-helpers";
import type { EditableOrder } from "./order-draft-types";

let oilItems: LineItemDraft[] = [];
const invalidateQueries = vi.fn();
const apiRequest = vi.fn();

vi.mock("./use-oil-lines", () => ({ useOilLines: () => ({ lineItems: oilItems }) }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries }) }));
vi.mock("@/lib/api-client", () => ({
  apiRequest: (...a: unknown[]) => apiRequest(...a),
  errorMessage: (e: unknown, d: string) => (e instanceof Error ? e.message : d),
}));

import { useOrderDraft } from "./use-order-draft";

const cfg = { apiBaseUrl: "x", authToken: "t" };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ev = { preventDefault: vi.fn() } as any;
const args = (over: Record<string, unknown> = {}) => ({
  open: true,
  onOpenChange: vi.fn(),
  products: [{ id: "p1", productName: "Oil 1", unit: "litres" as const, segments: ["Car"], packSizes: [1] }],
  actionConfig: cfg,
  ...over,
});

beforeEach(() => {
  oilItems = [];
});
afterEach(() => {
  invalidateQueries.mockReset();
  apiRequest.mockReset();
  vi.clearAllMocks();
});

describe("useOrderDraft — create mode", () => {
  it("seeds the header from initialCustomerId on open", () => {
    const { result } = renderHook(() => useOrderDraft(args({ initialCustomerId: "c9" })));
    expect(result.current.isEdit).toBe(false);
    expect(result.current.selectedCustomerId).toBe("c9");
  });

  it("blocks an empty order", async () => {
    const { result } = renderHook(() => useOrderDraft(args()));
    await act(async () => {
      await result.current.handleCreate(ev);
    });
    expect(result.current.createError).toMatch(/at least one oil/);
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("POSTs a valid new order, then invalidates + closes", async () => {
    oilItems = [{ uid: "o1", segment: "", productId: "p1", packSizeLitres: 1, quantityUnits: 5 }];
    apiRequest.mockResolvedValue({});
    const onOpenChange = vi.fn();
    const onCreated = vi.fn();
    const { result } = renderHook(() => useOrderDraft(args({ initialCustomerId: "c1", onOpenChange, onCreated })));
    await act(async () => {
      await result.current.handleCreate(ev);
    });
    expect(apiRequest).toHaveBeenCalledWith(cfg, "POST", "/orders", expect.objectContaining({ customerId: "c1" }));
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["orders"] });
    expect(onCreated).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("surfaces an API error without closing", async () => {
    oilItems = [{ uid: "o1", segment: "", productId: "p1", packSizeLitres: 1, quantityUnits: 5 }];
    apiRequest.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useOrderDraft(args({ initialCustomerId: "c1" })));
    await act(async () => {
      await result.current.handleCreate(ev);
    });
    expect(result.current.createError).toBe("boom");
  });
});

const editOrder: EditableOrder = {
  id: "o7",
  customerId: "c1",
  salesExecutiveId: "se1",
  orderDate: "2026-03-01",
  items: [
    { productId: "p2", quantityUnits: 3, packSizeLitres: 1, segment: "Car", invoicedUnits: 2, orderItemId: "oi2", label: "Oil2" },
  ],
};

describe("useOrderDraft — edit mode", () => {
  it("is an edit, seeds locked lines, and PATCHes", async () => {
    apiRequest.mockResolvedValue({});
    const { result } = renderHook(() => useOrderDraft(args({ order: editOrder })));
    expect(result.current.isEdit).toBe(true);
    expect(result.current.isPartial).toBe(true);
    act(() => result.current.setLockedQty("oi2", "9"));
    expect(result.current.lockedLines[0].quantityUnits).toBe("9");
    await act(async () => {
      await result.current.handleCreate(ev);
    });
    expect(apiRequest).toHaveBeenCalledWith(cfg, "PATCH", "/orders/o7", expect.anything());
  });

  it("updates only the matching locked line and skips re-seeding on close", () => {
    const twoLocked: EditableOrder = {
      ...editOrder,
      items: [
        editOrder.items[0],
        { productId: "p3", quantityUnits: 4, packSizeLitres: 1, segment: null, invoicedUnits: 1, orderItemId: "oi5", label: "Oil5" },
      ],
    };
    const { result, rerender } = renderHook(({ open }) => useOrderDraft(args({ order: twoLocked, open })), {
      initialProps: { open: true },
    });
    act(() => result.current.setLockedQty("oi2", "9"));
    expect(result.current.lockedLines.map((l) => l.quantityUnits)).toEqual(["9", "4"]);
    // Closing the dialog (open → false) must not re-seed.
    rerender({ open: false });
    expect(result.current.lockedLines).toHaveLength(2);
  });
});
