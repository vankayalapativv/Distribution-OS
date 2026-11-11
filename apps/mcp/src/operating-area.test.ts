import { afterEach, describe, expect, it, vi } from "vitest";

const runReadOnlySql = vi.fn();
vi.mock("./db", () => ({ runReadOnlySql: (...a: unknown[]) => runReadOnlySql(...a) }));

import { getOperatingArea, hasExplicitScope } from "./operating-area";

const rows = (value: unknown) => ({ rows: value === undefined ? [] : [{ value }] });

afterEach(() => runReadOnlySql.mockReset());

describe("getOperatingArea", () => {
  it("parses the stored JSON list of districts", async () => {
    runReadOnlySql.mockResolvedValue(
      rows(JSON.stringify([
        { state: "Telangana", name: "Nalgonda" },
        { state: "Telangana", name: "Khammam" },
      ])),
    );
    expect(await getOperatingArea("x")).toEqual([
      { state: "Telangana", name: "Nalgonda" },
      { state: "Telangana", name: "Khammam" },
    ]);
  });

  it("drops malformed entries and returns null when nothing valid remains", async () => {
    runReadOnlySql.mockResolvedValue(rows(JSON.stringify([{ state: "", name: "X" }, { name: "Y" }])));
    expect(await getOperatingArea("x")).toBeNull();
  });

  it("returns null when the JSON isn't an array", async () => {
    runReadOnlySql.mockResolvedValue(rows(JSON.stringify({ not: "an array" })));
    expect(await getOperatingArea("x")).toBeNull();
  });

  it("returns null when the setting is missing", async () => {
    runReadOnlySql.mockResolvedValue(rows(undefined));
    expect(await getOperatingArea("x")).toBeNull();
  });

  it("returns null on bad JSON or a query error (never throws)", async () => {
    runReadOnlySql.mockResolvedValue(rows("not json"));
    expect(await getOperatingArea("x")).toBeNull();
    runReadOnlySql.mockRejectedValue(new Error("db down"));
    expect(await getOperatingArea("x")).toBeNull();
  });
});

describe("hasExplicitScope", () => {
  it("is true when districts, a state, or several states are named", () => {
    expect(hasExplicitScope({ districts: [{ state: "T", name: "N" }] })).toBe(true);
    expect(hasExplicitScope({ state: "Telangana" })).toBe(true);
    expect(hasExplicitScope({ states: ["Telangana", "Andhra Pradesh"] })).toBe(true);
  });

  it("is false for a bare region with no named area (→ apply the operating default)", () => {
    expect(hasExplicitScope({})).toBe(false);
    expect(hasExplicitScope({ state: "  ", states: [], districts: [] })).toBe(false);
  });
});
