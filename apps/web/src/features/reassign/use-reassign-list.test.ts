import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useReassignList } from "./use-reassign-list";
import type { ReassignCustomerRow } from "./reassign-api";

const c = (
  id: string,
  name: string,
  owner: { id: string; name: string } | null,
  city: string | null,
  code: string | null = `VD-${id}`,
): ReassignCustomerRow => ({ id, legalName: name, customerCode: code, city, owner, recordCount: 1 });
const customers = [
  c("c1", "Alpha", { id: "o1", name: "Priya" }, "Khammam"),
  c("c2", "Beta", { id: "o2", name: "Vishnu" }, "Guntur"),
  c("c3", "Gamma", null, null, null), // no code + no city → exercises the `?? ""` fallbacks
];

describe("useReassignList", () => {
  it("derives distinct, name-sorted owners and returns all with no filters", () => {
    const { result } = renderHook(() => useReassignList(customers));
    expect(result.current.owners).toEqual([{ id: "o1", name: "Priya" }, { id: "o2", name: "Vishnu" }]);
    expect(result.current.filtered).toHaveLength(3);
  });

  it("filters by search across name, code and city", () => {
    const { result } = renderHook(() => useReassignList(customers));
    act(() => result.current.setSearch("khammam"));
    expect(result.current.filtered.map((x) => x.id)).toEqual(["c1"]);
    act(() => result.current.setSearch("VD-c2"));
    expect(result.current.filtered.map((x) => x.id)).toEqual(["c2"]);
    act(() => result.current.setSearch("beta"));
    expect(result.current.filtered.map((x) => x.id)).toEqual(["c2"]);
    act(() => result.current.setSearch("zzz")); // matches nothing → every row runs all operands
    expect(result.current.filtered).toEqual([]);
  });

  it("filters by owner (excluding unowned customers)", () => {
    const { result } = renderHook(() => useReassignList(customers));
    act(() => result.current.setOwner("o2"));
    expect(result.current.filtered.map((x) => x.id)).toEqual(["c2"]);
  });
});
