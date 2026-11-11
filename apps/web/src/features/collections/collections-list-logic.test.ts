import { describe, expect, it } from "vitest";
import { COLLECTION_FILTER_KEYS, COLLECTION_SORT, COLLECTION_STATUSES, parseYmd } from "./collections-list-logic";

describe("parseYmd", () => {
  it("parses a yyyy-MM-dd string into a local date (no UTC shift)", () => {
    const d = parseYmd("2026-09-14");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8); // September (0-indexed)
    expect(d.getDate()).toBe(14);
  });

  it("defaults missing month/day to the 1st", () => {
    const d = parseYmd("2026");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
  });
});

describe("collection list constants", () => {
  it("offers all four status filter options with 'all' first", () => {
    expect(COLLECTION_STATUSES.map((s) => s.value)).toEqual(["all", "pending", "verified", "rejected"]);
  });

  it("declares the URL filter keys and a date-desc default sort", () => {
    expect(COLLECTION_FILTER_KEYS).toContain("status");
    expect(COLLECTION_FILTER_KEYS).toContain("collectedBy");
    expect(COLLECTION_SORT).toEqual([{ id: "collectionDate", desc: true }]);
  });
});
