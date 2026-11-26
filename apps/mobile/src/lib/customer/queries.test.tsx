import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCustomerScreen } from "./queries";
import { cacheKeys } from "../cache-keys";

const apiFetch = vi.fn();
const invalidateQueries = vi.fn();
const useCachedQuery = vi.fn((cfg: unknown) => ({ cfg, data: undefined }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: (...a: unknown[]) => invalidateQueries(...a) }) }));
vi.mock("../api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("../use-cached-query", () => ({ useCachedQuery: (c: unknown) => useCachedQuery(c) }));

type Cfg = { queryKey: unknown[]; cacheKey: string; fetcher: () => Promise<unknown>; enabled: boolean };
const cfgs = () => useCachedQuery.mock.calls.map((c) => c[0] as Cfg);

afterEach(() => vi.clearAllMocks());

describe("useCustomerScreen", () => {
  it("wires the four read-through queries for a customer", () => {
    renderHook(() => useCustomerScreen("c1", "tok"));
    const [header, credit, orders, collections] = cfgs();
    expect(header).toMatchObject({ queryKey: ["customer", "c1"], cacheKey: cacheKeys.customerHeader("c1"), enabled: true });
    expect(credit).toMatchObject({ queryKey: ["credit", "c1"], cacheKey: cacheKeys.customerCredit("c1"), staleTime: 0 });
    expect(orders).toMatchObject({ queryKey: ["orders", "c1"], cacheKey: cacheKeys.customerOrders("c1") });
    expect(collections).toMatchObject({ queryKey: ["collections", "c1"], cacheKey: cacheKeys.customerCollections("c1") });
  });

  it("each fetcher hits its endpoint (credit mapped, orders/collections capped at 5)", async () => {
    renderHook(() => useCustomerScreen("c1", "tok"));
    const [header, credit, orders, collections] = cfgs();

    apiFetch.mockResolvedValueOnce({ id: "c1" });
    await header.fetcher();
    expect(apiFetch).toHaveBeenCalledWith("/customers/c1", { token: "tok" });

    apiFetch.mockResolvedValueOnce({ creditBlocked: true, creditOverdueDays: 45, totalOutstanding: 1200, extra: 1 });
    await expect(credit.fetcher()).resolves.toEqual({ creditBlocked: true, creditOverdueDays: 45, totalOutstanding: 1200 });

    apiFetch.mockResolvedValueOnce({ orders: Array.from({ length: 6 }, (_, i) => ({ id: i })) });
    await expect(orders.fetcher()).resolves.toHaveLength(5);
    expect(apiFetch).toHaveBeenCalledWith("/orders?customerId=c1", { token: "tok" });

    apiFetch.mockResolvedValueOnce(Array.from({ length: 7 }, (_, i) => ({ id: i })));
    await expect(collections.fetcher()).resolves.toHaveLength(5);
    expect(apiFetch).toHaveBeenCalledWith("/collections?customerId=c1", { token: "tok" });
  });

  it("disables the queries without an id or token", () => {
    renderHook(() => useCustomerScreen(undefined, "tok"));
    expect(cfgs()[0].enabled).toBe(false);
  });

  it("invalidate refreshes all four sections", async () => {
    const { result } = renderHook(() => useCustomerScreen("c1", "tok"));
    await result.current.invalidate();
    expect(invalidateQueries).toHaveBeenCalledTimes(4);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["customer", "c1"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["collections", "c1"] });
  });
});
