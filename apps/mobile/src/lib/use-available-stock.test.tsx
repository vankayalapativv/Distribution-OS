import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderHook } from "@testing-library/react";
import { useAvailableStock } from "./use-available-stock";
import type { AvailableStock, StockProduct } from "./stock";

const fetchAvailableStock = vi.fn();
const h = vi.hoisted(() => {
  const state = { data: undefined as unknown };
  const useQuery = vi.fn((_c: unknown) => ({ data: state.data, refetch: () => undefined }));
  return { state, useQuery };
});
vi.mock("@tanstack/react-query", () => ({ useQuery: (c: unknown) => h.useQuery(c) }));
vi.mock("expo-router", () => ({ useFocusEffect: (cb: () => void) => React.useEffect(() => cb(), [cb]) }));
vi.mock("./auth", () => ({ useAuth: (sel: (s: { token: string }) => unknown) => sel({ token: "tok" }) }));
vi.mock("./stock", () => ({ fetchAvailableStock: (...a: unknown[]) => fetchAvailableStock(...a) }));

const prod = (name: string, brand: string | null): StockProduct => ({
  productId: name, productName: name, brand, segment: null, unit: "litres", totalUnits: 0, packs: [],
});
afterEach(() => { vi.clearAllMocks(); h.state.data = undefined; });

describe("useAvailableStock", () => {
  it("configures the query and fetches on focus", () => {
    renderHook(() => useAvailableStock());
    const cfg = h.useQuery.mock.calls.at(-1)![0] as { queryKey: unknown[]; enabled: boolean; queryFn: () => unknown };
    expect(cfg).toMatchObject({ queryKey: ["available-stock"], enabled: true });
    cfg.queryFn();
    expect(fetchAvailableStock).toHaveBeenCalledWith("tok");
  });

  it("returns all products and godowns with no search term", () => {
    h.state.data = { godowns: [{ id: "g1", name: "Main" }], products: [prod("Mobil 5W", "Mobil"), prod("Shell HX", "Shell")] } as AvailableStock;
    const { result } = renderHook(() => useAvailableStock());
    expect(result.current.products).toHaveLength(2);
    expect(result.current.godowns).toEqual([{ id: "g1", name: "Main" }]);
    expect(result.current.searching).toBe(false);
  });

  it("filters by product name or brand (case-insensitive)", () => {
    h.state.data = { godowns: [], products: [prod("Mobil 5W", "Mobil"), prod("Shell HX", "Shell"), prod("Gear Oil", null)] } as AvailableStock;
    const { result, rerender } = renderHook(() => useAvailableStock());
    result.current.setSearch("shell");
    rerender();
    expect(result.current.products.map((p) => p.productName)).toEqual(["Shell HX"]);
    expect(result.current.searching).toBe(true);
  });

  it("yields empty lists before data loads", () => {
    const { result } = renderHook(() => useAvailableStock());
    expect(result.current.products).toEqual([]);
    expect(result.current.godowns).toEqual([]);
  });
});
