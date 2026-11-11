import { describe, expect, it } from "vitest";
import {
  COMPANY_STATE_CODE,
  balanceStmt,
  dateIso,
  finYearOf,
  mapBalanceRow,
  movementStmt,
  round2,
} from "./stock-shared";
import { makeSql, calledTag } from "../test/sql-mock";

describe("dateIso", () => {
  it("formats a Date to yyyy-mm-dd", () => {
    expect(dateIso(new Date("2026-10-31T18:30:00Z"))).toBe("2026-10-31");
  });
  it("slices a string and returns '' for anything else", () => {
    expect(dateIso("2026-04-01T00:00:00")).toBe("2026-04-01");
    expect(dateIso(null)).toBe("");
    expect(dateIso(42)).toBe("");
  });
});

describe("finYearOf", () => {
  it("puts Apr–Dec in the year's own FY and Jan–Mar in the previous", () => {
    expect(finYearOf("2026-10-31")).toBe("2026-27");
    expect(finYearOf("2026-04-01")).toBe("2026-27");
    expect(finYearOf("2026-03-31")).toBe("2025-26");
    expect(finYearOf("2026-01-01")).toBe("2025-26");
  });
});

describe("round2", () => {
  it("rounds to two decimals without float drift", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(2)).toBe(2);
  });
});

describe("COMPANY_STATE_CODE", () => {
  it("is Telangana (36)", () => {
    expect(COMPANY_STATE_CODE).toBe("36");
  });
});

const M = {
  locationId: "loc1",
  productId: "p1",
  packSizeLitres: 5,
  brand: "Fuchs",
  qtyUnits: 4,
  kind: "grn" as const,
  refType: "grn",
  refId: "ref1",
  note: null,
};

describe("movementStmt", () => {
  it("emits a stock_movement insert with signed litres derived from qty × pack", () => {
    const sql = makeSql();
    movementStmt(sql, { ...M, qtyUnits: 3, packSizeLitres: 2.5 }, "u1");
    const call = sql.calls.find((c) => c.tag === "stock_movement");
    expect(call).toBeDefined();
    expect(call!.params).toContain(7.5); // 3 × 2.5 litres
  });

  it("accepts an explicit movedAt and defaults it to null when omitted", () => {
    const sql = makeSql();
    movementStmt(sql, { ...M, movedAt: "2026-10-01" }, "u1");
    movementStmt(sql, M, "u1");
    expect(sql.calls.filter((c) => c.tag === "stock_movement")).toHaveLength(2);
  });
});

describe("balanceStmt", () => {
  it("uses a plain UPDATE for a decrement (delta < 0)", () => {
    const sql = makeSql();
    balanceStmt(sql, { locationId: "l", productId: "p", packSizeLitres: 1, delta: -2 });
    expect(calledTag(sql, "stock_balance_decrement")).toBe(true);
    expect(calledTag(sql, "stock_balance_upsert")).toBe(false);
  });

  it("upserts for an increment (delta >= 0)", () => {
    const sql = makeSql();
    balanceStmt(sql, { locationId: "l", productId: "p", packSizeLitres: 1, delta: 5 });
    expect(calledTag(sql, "stock_balance_upsert")).toBe(true);
  });
});

describe("mapBalanceRow", () => {
  it("maps fields, computes litres, and flags below-reorder", () => {
    const row = mapBalanceRow({
      locationId: "l1",
      locationName: "Main",
      productId: "p1",
      productName: "Titan",
      brand: "Fuchs",
      segment: "Car",
      packSizeLitres: "4",
      qtyUnits: "3",
      reorderLevel: "5",
    });
    expect(row).toMatchObject({ litres: 12, belowReorder: true, brand: "Fuchs", segment: "Car" });
  });

  it("leaves nullable fields null and never flags below-reorder without a level", () => {
    const row = mapBalanceRow({
      locationId: "l1",
      productId: "p1",
      packSizeLitres: 1,
      qtyUnits: 0,
      brand: null,
      segment: null,
      reorderLevel: null,
    });
    expect(row).toMatchObject({ brand: null, segment: null, reorderLevel: null, belowReorder: false });
  });
});
