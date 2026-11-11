import { describe, expect, it } from "vitest";
import { build, computeDragOver, daysToPersist, findCol, reorderWithin, type Items } from "./beat-board-logic";
import type { BeatCustomer } from "./beat-plans-api";

const cust = (id: string, weekday: number | null): BeatCustomer => ({
  customerId: id, customerCode: id, legalName: id, tradeName: null, phone: null, city: null,
  segment: null, weekday, sequenceNo: 0,
});
const empty = (): Items => ({ pool: [], "1": [], "2": [], "3": [], "4": [], "5": [], "6": [] });

describe("build", () => {
  it("groups customers into pool + weekday columns, preserving order", () => {
    const items = build([cust("a", 1), cust("b", 1), cust("c", null), cust("d", 6)]);
    expect(items["1"]).toEqual(["a", "b"]);
    expect(items.pool).toEqual(["c"]);
    expect(items["6"]).toEqual(["d"]);
  });
});

describe("findCol", () => {
  const items = { ...empty(), "1": ["a"], pool: ["b"] };
  it("returns a column id directly, the holding column for a card, else null", () => {
    expect(findCol(items, "1")).toBe("1");
    expect(findCol(items, "pool")).toBe("pool");
    expect(findCol(items, "a")).toBe("1");
    expect(findCol(items, "b")).toBe("pool");
    expect(findCol(items, "missing")).toBeNull();
  });
});

describe("computeDragOver", () => {
  it("moves a card into the column of the card it hovers, at that index", () => {
    const prev = { ...empty(), "1": ["a"], "2": ["x", "y"] };
    const next = computeDragOver(prev, "a", "y");
    expect(next!["1"]).toEqual([]);
    expect(next!["2"]).toEqual(["x", "a", "y"]);
  });
  it("appends when hovering an empty column id itself", () => {
    const prev = { ...empty(), "1": ["a"], "2": ["x"] };
    const next = computeDragOver(prev, "a", "2"); // over the column, not a card
    expect(next!["2"]).toEqual(["x", "a"]);
  });
  it("returns null when already in the hovered column or ids don't resolve", () => {
    const prev = { ...empty(), "1": ["a", "b"] };
    expect(computeDragOver(prev, "a", "b")).toBeNull(); // same column
    expect(computeDragOver(prev, "ghost", "1")).toBeNull(); // unknown active
  });
});

describe("reorderWithin", () => {
  it("reorders inside a column toward the hovered card", () => {
    const items = { ...empty(), "1": ["a", "b", "c"] };
    expect(reorderWithin(items, "1", "a", "c")["1"]).toEqual(["b", "c", "a"]);
  });
  it("drops to the end when hovering the column id itself", () => {
    const items = { ...empty(), "1": ["a", "b", "c"] };
    expect(reorderWithin(items, "1", "a", "1")["1"]).toEqual(["b", "c", "a"]);
  });
  it("returns the same reference when nothing moves", () => {
    const items = { ...empty(), "1": ["a", "b"] };
    expect(reorderWithin(items, "1", "a", "a")).toBe(items);
  });
});

describe("daysToPersist", () => {
  it("persists both endpoints of a cross-day move, skipping the pool", () => {
    expect(daysToPersist("1", "2")).toEqual(["1", "2"]);
    expect(daysToPersist("pool", "3")).toEqual(["3"]);
    expect(daysToPersist("4", "pool")).toEqual(["4"]);
    expect(daysToPersist("2", "2")).toEqual(["2"]);
  });
});
