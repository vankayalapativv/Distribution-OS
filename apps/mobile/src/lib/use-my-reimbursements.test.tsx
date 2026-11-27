import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderHook } from "@testing-library/react";
import { useMyReimbursements } from "./use-my-reimbursements";

const h = vi.hoisted(() => {
  const state = { data: { owedTotal: 450, payables: [] } as unknown };
  const refetch = vi.fn(() => Promise.resolve());
  const useQuery = vi.fn((c: unknown) => { (c as { queryFn?: () => unknown })?.queryFn?.(); return { data: state.data, refetch }; });
  return { state, refetch, useQuery };
});
vi.mock("@tanstack/react-query", () => ({ useQuery: (c: unknown) => h.useQuery(c) }));
vi.mock("expo-router", () => ({ useFocusEffect: (cb: () => void) => React.useEffect(() => cb(), [cb]) }));
vi.mock("./auth", () => ({ useAuth: (sel: (s: { token: string }) => unknown) => sel({ token: "tok" }) }));
const fetchMyReimbursements = vi.fn();
vi.mock("./reimbursements", () => ({ fetchMyReimbursements: (...a: unknown[]) => fetchMyReimbursements(...a) }));

beforeEach(() => { h.state.data = { owedTotal: 450, payables: [] }; });
afterEach(() => vi.clearAllMocks());

describe("useMyReimbursements", () => {
  it("configures the query, exposes the owed total, and refetches on focus", () => {
    const { result } = renderHook(() => useMyReimbursements());
    const cfg = h.useQuery.mock.calls.at(-1)![0] as { queryKey: unknown[]; enabled: boolean };
    expect(cfg).toMatchObject({ queryKey: ["my-reimbursements"], enabled: true });
    expect(fetchMyReimbursements).toHaveBeenCalledWith("tok");
    expect(result.current.owedTotal).toBe(450);
    expect(h.refetch).toHaveBeenCalled(); // focus effect
  });

  it("defaults the owed total to 0 before data arrives", () => {
    h.state.data = undefined;
    const { result } = renderHook(() => useMyReimbursements());
    expect(result.current.owedTotal).toBe(0);
  });
});
