import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const invalidateQueries = vi.fn();
const apiGet = vi.fn();
const apiRequest = vi.fn();

vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries }) }));
vi.mock("@/lib/api-client", () => ({
  apiGet: (...a: unknown[]) => apiGet(...a),
  apiRequest: (...a: unknown[]) => apiRequest(...a),
  errorMessage: (e: unknown, d: string) => (e instanceof Error ? e.message : d),
}));

import { useOrdersDialogs } from "./use-orders-dialogs";
import type { Order } from "./orders-api";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const row = { id: "o1", orderCode: "ORD-1", customerName: "Raj" } as Order;
const fetched = {
  id: "o1",
  customerId: "c1",
  customerName: "Raj",
  salesExecutiveId: null,
  orderDate: "2026-03-01",
  items: [],
};

afterEach(() => {
  invalidateQueries.mockReset();
  apiGet.mockReset();
  apiRequest.mockReset();
});

describe("useOrdersDialogs", () => {
  it("starts closed with no pending order or error", () => {
    const { result } = renderHook(() => useOrdersDialogs(cfg));
    expect(result.current.createOpen).toBe(false);
    expect(result.current.editingOrder).toBeNull();
    expect(result.current.actionError).toBeNull();
  });

  it("openEdit loads the order, maps it, and opens the edit dialog", async () => {
    apiGet.mockResolvedValue({ order: fetched });
    const { result } = renderHook(() => useOrdersDialogs(cfg));
    await act(async () => {
      await result.current.openEdit(row);
    });
    expect(apiGet).toHaveBeenCalledWith(cfg, "/orders/o1");
    expect(result.current.editingOrder?.id).toBe("o1");
    expect(result.current.editOpen).toBe(true);
  });

  it("openEdit surfaces a load error instead of opening", async () => {
    apiGet.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useOrdersDialogs(cfg));
    await act(async () => {
      await result.current.openEdit(row);
    });
    expect(result.current.editOpen).toBe(false);
    expect(result.current.actionError).toBe("boom");
  });

  it("doCancel posts a trimmed note (blank → null) and invalidates", async () => {
    apiRequest.mockResolvedValue({});
    const { result } = renderHook(() => useOrdersDialogs(cfg));
    await act(async () => {
      await result.current.doCancel(row);
    });
    expect(apiRequest).toHaveBeenCalledWith(cfg, "POST", "/orders/o1/cancel", { note: null });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["orders"] });

    act(() => result.current.setCancelNote("  duplicate  "));
    await act(async () => {
      await result.current.doCancel(row);
    });
    expect(apiRequest).toHaveBeenLastCalledWith(cfg, "POST", "/orders/o1/cancel", { note: "duplicate" });
  });

  it("doCancel sets the error and rethrows on failure", async () => {
    apiRequest.mockRejectedValue(new Error("nope"));
    const { result } = renderHook(() => useOrdersDialogs(cfg));
    await expect(result.current.doCancel(row)).rejects.toThrow("nope");
    await waitFor(() => expect(result.current.actionError).toBe("nope"));
  });

  it("invalidate delegates to the query client", () => {
    const { result } = renderHook(() => useOrdersDialogs(cfg));
    act(() => result.current.invalidate());
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["orders"] });
  });
});
