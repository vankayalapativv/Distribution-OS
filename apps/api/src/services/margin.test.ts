import { describe, expect, it } from "vitest";
import { createMarginSimulation, deleteMarginSimulation, listMarginSimulations, marginOf, updateMarginSimulation } from "./margin";
import { makeSql } from "../test/sql-mock";

const input = (over = {}) => ({ productId: "p1", productName: "Titan", packSize: 5, mrp: 500, dlp: 300, expensePerLiter: 2, schemePerLiter: 1, coupon: null, mop: 400, ...over });
const ROW = { id: "m1", productId: "p1", productName: "Titan", packSize: "5", mrp: "500", dlp: "300", expensePerLiter: "2", schemePerLiter: "1", coupon: null, mop: "400", marginPerPack: "85", marginPerLiter: "17", createdAt: new Date("2026-06-01T00:00:00Z") };

describe("marginOf", () => {
  it("applies the locked sheet formula", () => {
    const m = marginOf({ packSize: 5, dlp: 300, expensePerLiter: 2, schemePerLiter: 1, mop: 400 });
    expect(m.marginPerPack).toBe(400 - 1 * 5 - (300 + 2 * 5)); // 85
    expect(m.marginPerLiter).toBe(85 / 5);
    expect(marginOf({ packSize: 0, dlp: 1, expensePerLiter: 0, schemePerLiter: 0, mop: 1 }).marginPerLiter).toBe(0);
  });
});

describe("listMarginSimulations", () => {
  it("maps saved scenarios", async () => {
    expect((await listMarginSimulations(makeSql({ list_margin_simulations: [ROW] })))[0]).toMatchObject({ id: "m1" });
  });
});

describe("margin CRUD", () => {
  it("create validates pack size and returns the mapped row (Date coercion)", async () => {
    await expect(createMarginSimulation(makeSql(), { userId: "u1" }, input({ packSize: 0 }))).rejects.toMatchObject({ status: 422 });
    const sql = makeSql({ create_margin_simulation: [ROW] });
    expect(await createMarginSimulation(sql, { userId: "u1" }, input())).toMatchObject({ id: "m1", packSize: 5, coupon: null });
  });
  it("update 404s / returns the row; delete 404s / resolves", async () => {
    expect(await updateMarginSimulation(makeSql({ update_margin_simulation: [ROW] }), "m1", input())).toMatchObject({ id: "m1" });
    await expect(updateMarginSimulation(makeSql({ update_margin_simulation: [] }), "x", input())).rejects.toMatchObject({ status: 404 });
    await expect(deleteMarginSimulation(makeSql({ delete_margin_simulation: [{ id: "m1" }] }), "m1")).resolves.toBeUndefined();
    await expect(deleteMarginSimulation(makeSql({ delete_margin_simulation: [] }), "x")).rejects.toMatchObject({ status: 404 });
  });
});
