import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCachedQuery } from "./use-cached-query";

const useQuery = vi.fn();
const cachedFetch = vi.fn();
const readCache = vi.fn();
vi.mock("@tanstack/react-query", () => ({ useQuery: (cfg: unknown) => useQuery(cfg) }));
vi.mock("./read-cache", () => ({
  cachedFetch: (...a: unknown[]) => cachedFetch(...a),
  readCache: (...a: unknown[]) => readCache(...a),
}));

type Cfg = { queryKey: unknown; queryFn: () => unknown; initialData?: unknown; initialDataUpdatedAt?: number };
const lastCfg = () => useQuery.mock.calls.at(-1)![0] as Cfg;

afterEach(() => vi.clearAllMocks());

describe("useCachedQuery", () => {
  it("seeds initialData from the cache and unwraps data + fromCache", () => {
    readCache.mockReturnValue({ data: { n: 1 }, cachedAt: 500 });
    useQuery.mockReturnValue({ data: { data: { n: 1 }, fromCache: true }, isPending: false });
    const fetcher = vi.fn();
    const { result } = renderHook(() =>
      useCachedQuery({ queryKey: ["k"], cacheKey: "ck", fetcher }),
    );
    expect(result.current.data).toEqual({ n: 1 });
    expect(result.current.fromCache).toBe(true);

    const cfg = lastCfg();
    expect(cfg.initialData).toEqual({ data: { n: 1 }, fromCache: true });
    expect(cfg.initialDataUpdatedAt).toBe(500);
    // queryFn delegates to cachedFetch(cacheKey, fetcher)
    cfg.queryFn();
    expect(cachedFetch).toHaveBeenCalledWith("ck", fetcher);
  });

  it("has no initialData and fromCache=false when the cache is empty", () => {
    readCache.mockReturnValue(undefined);
    useQuery.mockReturnValue({ data: undefined, isPending: true });
    const { result } = renderHook(() =>
      useCachedQuery({ queryKey: ["k"], cacheKey: "ck", fetcher: vi.fn() }),
    );
    expect(result.current.data).toBeUndefined();
    expect(result.current.fromCache).toBe(false);
    expect(lastCfg().initialData).toBeUndefined();
  });
});
