import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useOrderQueries } from "./use-order-queries";
import { cacheKeys } from "../cache-keys";

const useQuery = vi.fn((cfg: unknown) => ({ cfg }));
const useCachedQuery = vi.fn((cfg: unknown) => ({ cfg }));
const fetchOils = vi.fn();
const fetchCredit = vi.fn();

vi.mock("@tanstack/react-query", () => ({ useQuery: (c: unknown) => useQuery(c) }));
vi.mock("../use-cached-query", () => ({ useCachedQuery: (c: unknown) => useCachedQuery(c) }));
vi.mock("./api", () => ({
  fetchOils: (...a: unknown[]) => fetchOils(...a),
  fetchCredit: (...a: unknown[]) => fetchCredit(...a),
}));

type QueryCfg = { queryKey: unknown[]; enabled: boolean; fetcher?: () => unknown; queryFn?: () => unknown; cacheKey?: string };
const lastCfg = (fn: typeof useQuery): QueryCfg => fn.mock.calls.at(-1)![0] as QueryCfg;

afterEach(() => {
  useQuery.mockClear();
  useCachedQuery.mockClear();
  fetchOils.mockClear();
  fetchCredit.mockClear();
});

describe("useOrderQueries", () => {
  it("wires the cached oils query (enabled with a token) to fetchOils", () => {
    renderHook(() => useOrderQueries("c1", "tok"));
    const cfg = lastCfg(useCachedQuery);
    expect(cfg.queryKey).toEqual(["order-oils"]);
    expect(cfg.cacheKey).toBe(cacheKeys.orderOils);
    expect(cfg.enabled).toBe(true);
    cfg.fetcher!();
    expect(fetchOils).toHaveBeenCalledWith("tok");
  });

  it("wires the credit query (enabled with customer + token) to fetchCredit", () => {
    renderHook(() => useOrderQueries("c1", "tok"));
    const cfg = lastCfg(useQuery);
    expect(cfg.queryKey).toEqual(["order-credit", "c1"]);
    expect(cfg.enabled).toBe(true);
    cfg.queryFn!();
    expect(fetchCredit).toHaveBeenCalledWith("c1", "tok");
  });

  it("disables both queries without a token", () => {
    renderHook(() => useOrderQueries("c1", null));
    expect(lastCfg(useCachedQuery).enabled).toBe(false);
    expect(lastCfg(useQuery).enabled).toBe(false);
  });

  it("disables the credit query without a customer", () => {
    renderHook(() => useOrderQueries(undefined, "tok"));
    expect(lastCfg(useCachedQuery).enabled).toBe(true);
    expect(lastCfg(useQuery).enabled).toBe(false);
  });
});
