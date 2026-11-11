import { describe, expect, it } from "vitest";
import { assertBrandCategory, ensureBrand, listBrands } from "./brands";
import { makeSql, calledTag } from "../test/sql-mock";

describe("assertBrandCategory", () => {
  it("accepts the only valid category", () => {
    expect(assertBrandCategory("oils")).toBe("oils");
  });

  it("rejects anything else with a 422", () => {
    expect(() => assertBrandCategory("bearings")).toThrowError(/category must be oils/);
    expect(() => assertBrandCategory(123)).toThrowError(/category must be oils/);
  });
});

describe("listBrands", () => {
  it("returns the distinct brand names from live SKUs", async () => {
    const sql = makeSql({ list_brands_oils: [{ name: "Fuchs" }, { name: "Savsol" }] });
    expect(await listBrands(sql, "oils")).toEqual(["Fuchs", "Savsol"]);
  });

  it("returns an empty list when no SKU carries a brand", async () => {
    const sql = makeSql({ list_brands_oils: [] });
    expect(await listBrands(sql, "oils")).toEqual([]);
  });
});

describe("ensureBrand", () => {
  it("trims, upserts, and returns the brand name", async () => {
    const sql = makeSql({ upsert_brand: [] });
    expect(await ensureBrand(sql, "oils", "  Fuchs  ")).toBe("Fuchs");
    expect(calledTag(sql, "upsert_brand")).toBe(true);
  });

  it("rejects a blank or non-string brand with a 422 (and never writes)", async () => {
    const sql = makeSql();
    await expect(ensureBrand(sql, "oils", "   ")).rejects.toMatchObject({ code: "INVALID_FIELD", status: 422 });
    await expect(ensureBrand(sql, "oils", null)).rejects.toMatchObject({ status: 422 });
    expect(calledTag(sql, "upsert_brand")).toBe(false);
  });
});
