import { describe, expect, it } from "vitest";
import { buildSearchConds, resolvePage, resolveSort, searchTokens } from "./pagination";

describe("searchTokens", () => {
  it("lowercases, strips non-alphanumerics, drops empties", () => {
    expect(searchTokens("Titan 15W40")).toEqual(["titan", "15w40"]);
    expect(searchTokens("SUPER 4")).toEqual(["super", "4"]);
    expect(searchTokens("15W_40")).toEqual(["15w40"]); // underscore stripped, one token
    expect(searchTokens("  spaced   out  ")).toEqual(["spaced", "out"]);
  });

  it("neutralizes ILIKE wildcards (no injection)", () => {
    expect(searchTokens("%")).toEqual([]); // pure wildcard → nothing to match
    expect(searchTokens("_")).toEqual([]);
    expect(searchTokens("50%")).toEqual(["50"]); // % dropped, literal digits kept
  });

  it("handles null/undefined/empty", () => {
    expect(searchTokens(null)).toEqual([]);
    expect(searchTokens(undefined)).toEqual([]);
    expect(searchTokens("   ")).toEqual([]);
  });
});

describe("buildSearchConds", () => {
  const BLOB = "lower(x)";

  it("builds one AND-ed condition per token, offset by startIndex", () => {
    const { conds, params } = buildSearchConds(BLOB, "titan 15w40", 1);
    // startIndex 1 → params bind at $2 and $3 (e.g. $1 already used by a status filter)
    expect(conds).toEqual(["lower(x) ilike $2", "lower(x) ilike $3"]);
    expect(params).toEqual(["%titan%", "%15w40%"]);
  });

  it("binds from $1 when nothing precedes it", () => {
    const { conds, params } = buildSearchConds(BLOB, "fuchs", 0);
    expect(conds).toEqual(["lower(x) ilike $1"]);
    expect(params).toEqual(["%fuchs%"]);
  });

  it("returns no conditions for an empty or wildcard-only search", () => {
    expect(buildSearchConds(BLOB, "", 0)).toEqual({ conds: [], params: [] });
    expect(buildSearchConds(BLOB, "%", 0)).toEqual({ conds: [], params: [] });
    expect(buildSearchConds(BLOB, null, 0)).toEqual({ conds: [], params: [] });
  });
});

describe("resolveSort", () => {
  const allowed = { name: "p.name", createdAt: "p.created_at" };
  it("whitelists the column and clamps direction", () => {
    expect(resolveSort("name", "asc", allowed, "createdAt")).toEqual({ expr: "p.name", dir: "asc" });
    expect(resolveSort("evil; drop", "x", allowed, "createdAt")).toEqual({ expr: "p.created_at", dir: "desc" });
  });
});

describe("resolvePage", () => {
  it("clamps page size and computes offset", () => {
    expect(resolvePage(2, 8)).toEqual({ limit: 8, offset: 8, page: 2, pageSize: 8 });
    expect(resolvePage(0, 9999)).toEqual({ limit: 100, offset: 0, page: 1, pageSize: 100 });
    expect(resolvePage(null, null)).toEqual({ limit: 8, offset: 0, page: 1, pageSize: 8 });
  });
});
