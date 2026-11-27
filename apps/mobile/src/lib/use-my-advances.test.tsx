import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderHook } from "@testing-library/react";
import { useMyAdvances } from "./use-my-advances";

const h = vi.hoisted(() => {
  const state = { data: { outstandingTotal: 8000, advances: [] } as unknown };
  const refetch = vi.fn(() => Promise.resolve());
  const useQuery = vi.fn((c: unknown) => { (c as { queryFn?: () => unknown })?.queryFn?.(); return { data: state.data, refetch }; });
  return { state, refetch, useQuery };
});
vi.mock("@tanstack/react-query", () => ({ useQuery: (c: unknown) => h.useQuery(c) }));
vi.mock("expo-router", () => ({ useFocusEffect: (cb: () => void) => React.useEffect(() => cb(), [cb]) }));
vi.mock("./auth", () => ({ useAuth: (sel: (s: { token: string }) => unknown) => sel({ token: "tok" }) }));
const fetchMyAdvances = vi.fn();
vi.mock("./advances", () => ({ fetchMyAdvances: (...a: unknown[]) => fetchMyAdvances(...a) }));

beforeEach(() => { h.state.data = { outstandingTotal: 8000, advances: [] }; });
afterEach(() => vi.clearAllMocks());

describe("useMyAdvances", () => {
  it("configures the query, exposes the outstanding total, and refetches on focus", () => {
    const { result } = renderHook(() => useMyAdvances());
    const cfg = h.useQuery.mock.calls.at(-1)![0] as { queryKey: unknown[]; enabled: boolean };
    expect(cfg).toMatchObject({ queryKey: ["my-advances"], enabled: true });
    expect(fetchMyAdvances).toHaveBeenCalledWith("tok");
    expect(result.current.outstandingTotal).toBe(8000);
    expect(h.refetch).toHaveBeenCalled();
  });

  it("defaults the total to 0 before data arrives", () => {
    h.state.data = undefined;
    const { result } = renderHook(() => useMyAdvances());
    expect(result.current.outstandingTotal).toBe(0);
  });
});
