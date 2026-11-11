import { describe, expect, it } from "vitest";
import { createLocation, listLocations, renameLocation, updateLocation } from "./stock-locations";
import { makeSql } from "../test/sql-mock";

const LOC_ROW = {
  id: "loc-1",
  name: "Main Godown",
  code: "G1",
  city: "Hyderabad",
  state: "Telangana",
  stateCode: "36",
  pincode: "500001",
  isDefault: true,
  status: "active",
  skuCount: "12",
  totalLitres: "480",
};

const INPUT = {
  name: "Main Godown",
  code: "G1",
  city: "Hyderabad",
  state: "Telangana",
  stateCode: "36",
  pincode: "500001",
  isDefault: true,
};

describe("listLocations", () => {
  it("maps each location with its SKU count + total litres", async () => {
    const sql = makeSql({ list_stock_locations: [LOC_ROW] });
    const [loc] = await listLocations(sql, { activeOnly: true });
    expect(loc).toMatchObject({ id: "loc-1", name: "Main Godown", isDefault: true, skuCount: 12, totalLitres: 480 });
  });

  it("defaults activeOnly to false and leaves null code/city/pincode null", async () => {
    const sql = makeSql({
      list_stock_locations: [{ ...LOC_ROW, code: null, city: null, pincode: null }],
    });
    const [loc] = await listLocations(sql);
    expect(loc).toMatchObject({ code: null, city: null, pincode: null });
  });
});

describe("createLocation", () => {
  it("rejects a blank name (422)", async () => {
    await expect(createLocation(makeSql(), "u1", { ...INPUT, name: "  " })).rejects.toMatchObject({ status: 422 });
  });

  it("clears the previous default, inserts, and returns the mapped location", async () => {
    const sql = makeSql({ create_stock_location: [], "": [{ ...LOC_ROW, skuCount: 0, totalLitres: 0 }] });
    const loc = await createLocation(sql, "u1", INPUT);
    expect(loc).toMatchObject({ id: "loc-1", isDefault: true });
    // The default-clearing UPDATE ran because isDefault was true.
    expect(sql.calls.some((c) => c.tag === "" && /is_default = false where is_default/.test(c.text))).toBe(true);
  });

  it("maps a duplicate-code violation to a 409", async () => {
    const sql = makeSql({
      create_stock_location: () => {
        throw new Error('duplicate key value violates unique constraint "stock_locations_code_key"');
      },
    });
    await expect(createLocation(sql, "u1", { ...INPUT, isDefault: false })).rejects.toMatchObject({
      code: "CONFLICT",
      status: 409,
    });
  });

  it("rethrows an unrelated insert error unchanged", async () => {
    const boom = new Error("connection reset");
    const sql = makeSql({
      create_stock_location: () => {
        throw boom;
      },
    });
    await expect(createLocation(sql, "u1", { ...INPUT, isDefault: false })).rejects.toBe(boom);
  });
});

describe("renameLocation", () => {
  it("rejects a blank name (422)", async () => {
    await expect(renameLocation(makeSql(), "loc-1", " ")).rejects.toMatchObject({ status: 422 });
  });

  it("renames and returns the mapped location", async () => {
    const sql = makeSql({ rename_stock_location: [{ id: "loc-1" }], "": [LOC_ROW] });
    expect(await renameLocation(sql, "loc-1", "New Name")).toMatchObject({ id: "loc-1" });
  });

  it("404s when the godown is missing", async () => {
    const sql = makeSql({ rename_stock_location: [] });
    await expect(renameLocation(sql, "loc-x", "x")).rejects.toMatchObject({ status: 404 });
  });
});

describe("updateLocation", () => {
  it("updates and returns the mapped location (clearing other defaults)", async () => {
    const sql = makeSql({ update_stock_location: [{ id: "loc-1" }], "": [LOC_ROW] });
    expect(await updateLocation(sql, "loc-1", INPUT)).toMatchObject({ id: "loc-1", isDefault: true });
  });

  it("404s when the godown is missing", async () => {
    const sql = makeSql({ update_stock_location: [] });
    await expect(updateLocation(sql, "loc-x", { ...INPUT, isDefault: false })).rejects.toMatchObject({ status: 404 });
  });
});
