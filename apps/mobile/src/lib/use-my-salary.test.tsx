import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderHook } from "@testing-library/react";
import { useMySalary } from "./use-my-salary";

const h = vi.hoisted(() => {
  const state = { data: { monthlySalary: 20000, advanceOutstanding: 0, thisMonth: null } as unknown };
  const refetch = vi.fn(() => Promise.resolve());
  const useQuery = vi.fn((c: unknown) => { (c as { queryFn?: () => unknown })?.queryFn?.(); return { data: state.data, refetch }; });
  return { state, refetch, useQuery };
});
vi.mock("@tanstack/react-query", () => ({ useQuery: (c: unknown) => h.useQuery(c) }));
vi.mock("expo-router", () => ({ useFocusEffect: (cb: () => void) => React.useEffect(() => cb(), [cb]) }));
vi.mock("./auth", () => ({ useAuth: (sel: (s: { token: string }) => unknown) => sel({ token: "tok" }) }));
const fetchMySalary = vi.fn();
vi.mock("./salary", () => ({ fetchMySalary: (...a: unknown[]) => fetchMySalary(...a) }));

beforeEach(() => { h.state.data = { monthlySalary: 20000, advanceOutstanding: 0, thisMonth: null }; });
afterEach(() => vi.clearAllMocks());

describe("useMySalary", () => {
  it("configures the query, returns pay, and refetches on focus", () => {
    const { result } = renderHook(() => useMySalary());
    const cfg = h.useQuery.mock.calls.at(-1)![0] as { queryKey: unknown[]; enabled: boolean };
    expect(cfg).toMatchObject({ queryKey: ["my-salary"], enabled: true });
    expect(fetchMySalary).toHaveBeenCalledWith("tok");
    expect(result.current.pay).toMatchObject({ monthlySalary: 20000 });
    expect(h.refetch).toHaveBeenCalled();
  });

  it("returns null before data arrives", () => {
    h.state.data = undefined;
    const { result } = renderHook(() => useMySalary());
    expect(result.current.pay).toBeNull();
  });
});
