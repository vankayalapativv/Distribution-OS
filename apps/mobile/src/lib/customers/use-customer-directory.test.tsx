import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, renderHook } from "@testing-library/react";
import { useCustomerDirectory } from "./use-customer-directory";
import type { DirectoryCustomer } from "../customer-directory";

const refetch = vi.fn<() => Promise<void>>(() => Promise.resolve());
const resetQueries = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const fetchSeCustomers = vi.fn();
const useCachedQuery = vi.fn(
  (_cfg: unknown): { data: DirectoryCustomer[] | undefined; refetch: typeof refetch } => ({ data: customers, refetch }),
);
const dismiss = vi.fn();
let customers: DirectoryCustomer[] = [];
let token: string | null = "tok";

vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ resetQueries: (...a: unknown[]) => resetQueries(...a) }) }));
vi.mock("expo-router", () => ({ useFocusEffect: (cb: () => void) => React.useEffect(() => cb(), [cb]) }));
vi.mock("react-native", () => ({ FlatList: () => null, Keyboard: { dismiss: () => dismiss() } }));
vi.mock("../auth", () => ({ useAuth: (sel: (s: { token: string | null }) => unknown) => sel({ token }) }));
vi.mock("../customer-directory", () => ({ fetchSeCustomers: (...a: unknown[]) => fetchSeCustomers(...a) }));
vi.mock("../use-cached-query", () => ({ useCachedQuery: (c: unknown) => useCachedQuery(c) }));
vi.mock("../use-pull-refresh", () => ({ usePullRefresh: (fn: () => Promise<void>) => ({ refreshing: false, onRefresh: fn }) }));

function dir(name: string): DirectoryCustomer { return { id: name, code: null, name, phone: null, address: null, city: null }; }

beforeEach(() => {
  vi.useFakeTimers();
  token = "tok";
  customers = [dir("Apple"), dir("Banana"), dir("Cat"), dir("Dog"), dir("9 Store")];
});
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe("useCustomerDirectory", () => {
  it("builds rows + sticky header indices and shows the A–Z index for 4+ letters", () => {
    const { result } = renderHook(() => useCustomerDirectory());
    expect(result.current.rows.length).toBeGreaterThan(0);
    // header rows (A,B,C,D,#) are the sticky indices
    expect(result.current.stickyHeaderIndices.length).toBe(5);
    expect(result.current.showIndex).toBe(true);
    expect(result.current.searching).toBe(false);
  });

  it("refetches on focus and wires the SE-customers fetcher", () => {
    renderHook(() => useCustomerDirectory());
    expect(refetch).toHaveBeenCalled();
    const cfg = useCachedQuery.mock.calls.at(-1)![0] as { fetcher: () => unknown; enabled: boolean };
    cfg.fetcher();
    expect(fetchSeCustomers).toHaveBeenCalledWith("tok");
    expect(cfg.enabled).toBe(true);
  });

  it("debounces the search term before filtering", () => {
    const { result } = renderHook(() => useCustomerDirectory());
    act(() => result.current.setSearch("apple"));
    expect(result.current.searching).toBe(false); // not yet (debounced)
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.searching).toBe(true);
    expect(result.current.showIndex).toBe(false); // hidden while searching
    expect(result.current.rows.filter((r) => r.kind === "item")).toHaveLength(1);
  });

  it("pull-to-refresh resets the customers query", async () => {
    const { result } = renderHook(() => useCustomerDirectory());
    await act(async () => { await result.current.onRefresh(); });
    expect(resetQueries).toHaveBeenCalledWith({ queryKey: ["customers"] });
  });

  it("jumpTo scrolls the list to a present letter and no-ops for an absent one", () => {
    const { result } = renderHook(() => useCustomerDirectory());
    // Ref not yet attached → optional-chaining short-circuits (no throw).
    act(() => result.current.jumpTo("B"));
    expect(dismiss).toHaveBeenCalled();
    // Ref attached → scrollToOffset is invoked.
    const scrollToOffset = vi.fn();
    (result.current.listRef as { current: unknown }).current = { scrollToOffset };
    act(() => result.current.jumpTo("B"));
    expect(scrollToOffset).toHaveBeenCalledWith(expect.objectContaining({ animated: false }));
    dismiss.mockClear();
    act(() => result.current.jumpTo("Q")); // no customers under Q → early return
    expect(dismiss).not.toHaveBeenCalled();
  });

  it("hides the index when there are 3 or fewer letters", () => {
    customers = [dir("Apple"), dir("Banana")];
    const { result } = renderHook(() => useCustomerDirectory());
    expect(result.current.showIndex).toBe(false);
  });

  it("falls back to an empty list before the query resolves", () => {
    useCachedQuery.mockReturnValueOnce({ data: undefined, refetch });
    const { result } = renderHook(() => useCustomerDirectory());
    expect(result.current.customers).toEqual([]);
    expect(result.current.rows).toEqual([]);
  });
});
