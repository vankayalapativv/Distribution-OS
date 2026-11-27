import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, renderHook } from "@testing-library/react";
import { useMyClaims } from "./use-my-claims";

let pullFn: () => Promise<void>;
const h = vi.hoisted(() => {
  const state = { data: [{ id: "c1" }] as unknown, isPending: false, isError: false, error: undefined as unknown };
  const refetch = vi.fn(() => Promise.resolve());
  const useQuery = vi.fn((c: unknown) => {
    (c as { queryFn?: () => unknown })?.queryFn?.(); // execute the queryFn arrow so it's covered
    return { data: state.data, isPending: state.isPending, isError: state.isError, error: state.error, refetch };
  });
  return { state, refetch, useQuery };
});
vi.mock("@tanstack/react-query", () => ({ useQuery: (c: unknown) => h.useQuery(c) }));
vi.mock("expo-router", () => ({ useFocusEffect: (cb: () => void) => React.useEffect(() => cb(), [cb]) }));
vi.mock("./auth", () => ({ useAuth: (sel: (s: { token: string }) => unknown) => sel({ token: "tok" }) }));
vi.mock("./expense-claims", () => ({ fetchMyClaims: vi.fn() }));
vi.mock("./use-pull-refresh", () => ({ usePullRefresh: (fn: () => Promise<void>) => { pullFn = fn; return { refreshing: false, onRefresh: fn }; } }));

beforeEach(() => { h.state.data = [{ id: "c1" }]; h.state.isPending = false; h.state.isError = false; h.state.error = undefined; });
afterEach(() => vi.clearAllMocks());

describe("useMyClaims", () => {
  it("configures the query and refetches on focus", () => {
    const { result } = renderHook(() => useMyClaims());
    const cfg = h.useQuery.mock.calls.at(-1)![0] as { queryKey: unknown[]; enabled: boolean };
    expect(cfg).toMatchObject({ queryKey: ["my-claims"], enabled: true });
    expect(result.current.claims).toEqual([{ id: "c1" }]);
    expect(h.refetch).toHaveBeenCalled(); // focus effect
  });

  it("surfaces loading and defaults to an empty list", () => {
    h.state.isPending = true; h.state.data = undefined;
    const { result } = renderHook(() => useMyClaims());
    expect(result.current.loading).toBe(true);
    expect(result.current.claims).toEqual([]);
  });

  it("exposes a retryable error only when the list is empty", () => {
    h.state.isError = true; h.state.error = new Error("offline"); h.state.data = [];
    const { result } = renderHook(() => useMyClaims());
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.retry).toBe(h.refetch);
  });

  it("hides the error when cached claims are shown", () => {
    h.state.isError = true; h.state.error = new Error("x"); h.state.data = [{ id: "c1" }];
    const { result } = renderHook(() => useMyClaims());
    expect(result.current.error).toBeNull();
  });

  it("pull-to-refresh refetches", async () => {
    renderHook(() => useMyClaims());
    h.refetch.mockClear();
    await act(async () => { await pullFn(); });
    expect(h.refetch).toHaveBeenCalled();
  });
});
