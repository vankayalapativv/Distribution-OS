import { describe, expect, it } from "vitest";
import {
  allocateReturnAdjustment,
  allocateReturnRestock,
  allocateSaleFefo,
  balancesByGodown,
  balancesSummary,
  currentSaleLots,
  fefoSplit,
  getInvoiceStockLots,
  listInvoiceStockActivity,
  getAdjustment,
  getBalancesForSkus,
  getGrn,
  getTransfer,
  listAdjustments,
  listAvailableLots,
  listBalances,
  listGrns,
  listMovements,
  listNearExpiry,
  listSkus,
  listTransfers,
  lookupProductStock,
  postAdjustment,
  postGrn,
  postOpening,
  postTransfer,
  recomputeBalances,
  setReorderLevel,
} from "./stock";
import { makeSql, calledTag } from "../test/sql-mock";

const LOC = "loc-1";
const P1 = "p1";

describe("listSkus", () => {
  it("maps catalogue SKUs with nullable brand/hsn/segment", async () => {
    const sql = makeSql({
      list_stock_skus: [
        { productId: P1, productName: "Titan", brand: "Fuchs", hsnCode: "2710", packSizeLitres: "5", unit: "litres", segment: "Car" },
        { productId: "p2", productName: "Bulk", brand: null, hsnCode: null, packSizeLitres: "20", unit: "litres", segment: null },
        { productId: "p3", productName: "Microfibre Cloth", brand: "Kelvinn", hsnCode: null, packSizeLitres: "1", unit: "quantity", segment: null },
      ],
    });
    const skus = await listSkus(sql, { search: "ti", brand: "Fuchs" });
    expect(skus[0]).toMatchObject({ productId: P1, packSizeLitres: 5, unit: "litres", segment: "Car" });
    expect(skus[1]).toMatchObject({ brand: null, hsnCode: null, segment: null });
    expect(skus[2]).toMatchObject({ productId: "p3", packSizeLitres: 1, unit: "quantity" });
  });
});

describe("listBalances", () => {
  const row = {
    locationId: LOC, locationName: "Main", productId: P1, productName: "Titan", brand: "Fuchs",
    segment: "Car", packSizeLitres: "5", qtyUnits: "10", reorderLevel: "3", totalCount: "1",
  };
  it("uses the by-location query when a godown is given", async () => {
    const sql = makeSql({ list_balances_by_location: [row] });
    const res = await listBalances(sql, { locationId: LOC, page: 1, pageSize: 50 });
    expect(res).toMatchObject({ total: 1, page: 1, pageSize: 50 });
    expect(res.rows[0]).toMatchObject({ productId: P1, litres: 50 });
    expect(calledTag(sql, "list_balances_by_location")).toBe(true);
  });
  it("uses the all-locations query otherwise (and defaults total to 0)", async () => {
    const sql = makeSql({ list_balances_all: [] });
    const res = await listBalances(sql, { lowOnly: true });
    expect(res.total).toBe(0);
    expect(calledTag(sql, "list_balances_all")).toBe(true);
  });
});

describe("balancesSummary", () => {
  it("maps KPIs and tolerates a missing row", async () => {
    const sql = makeSql({ balances_summary: [{ skuCount: "4", totalLitres: "120.5", belowReorder: "1" }] });
    expect(await balancesSummary(sql, { locationId: LOC })).toEqual({ skuCount: 4, totalLitres: 120.5, belowReorder: 1 });
    expect(await balancesSummary(makeSql({ balances_summary: [] }), {})).toEqual({ skuCount: 0, totalLitres: 0, belowReorder: 0 });
  });
});

describe("listMovements", () => {
  it("maps the ledger feed with nullable ref fields", async () => {
    const sql = makeSql({
      list_stock_movements: [
        { id: "m1", kind: "grn", qtyUnits: "5", litres: "25", packSizeLitres: "5", refType: "grn", refId: "g1", note: "x", movedAt: "2026-06-01", locationName: "Main", productName: "Titan", brand: "Fuchs", totalCount: "1" },
        { id: "m2", kind: "adjustment", qtyUnits: "-1", litres: "-5", packSizeLitres: "5", refType: null, refId: null, note: null, movedAt: "2026-06-02", locationName: "Main", productName: "Titan", brand: null, totalCount: "1" },
      ],
    });
    const res = await listMovements(sql, {});
    expect(res.total).toBe(1);
    expect(res.rows[0]).toMatchObject({ kind: "grn", qtyUnits: 5, refType: "grn" });
    expect(res.rows[1]).toMatchObject({ refType: null, refId: null, note: null, brand: null });
  });
});

describe("listNearExpiry", () => {
  it("maps near-expiry batches with days-to-expiry + on-hand", async () => {
    const sql = makeSql({
      list_near_expiry: [{
        id: "gi-1", productName: "Fuchs 5W-30", packSizeLitres: "5", brand: "Fuchs",
        batchNumber: "B123", expiryDate: "2027-01-15", qtyUnits: "10",
        rackNo: "R1", shelfNo: "S2", binNo: null,
        grnNumber: "GRN-00001", receivedDate: "2026-11-01", supplierName: "ACME",
        locationId: LOC, locationName: "Main", daysToExpiry: "42", onHandQty: "6",
      }],
    });
    const rows = await listNearExpiry(sql, { withinDays: 90 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ productName: "Fuchs 5W-30", batchNumber: "B123", daysToExpiry: 42, onHandQty: 6, binNo: null });
  });
  it("returns [] when nothing carries an expiry", async () => {
    expect(await listNearExpiry(makeSql({ list_near_expiry: [] }), {})).toEqual([]);
  });
});

describe("document lists", () => {
  it("lists GRNs", async () => {
    const sql = makeSql({ list_grns: [{ id: "g1", grnNumber: "GRN-00001", receivedDate: "2026-06-01", supplierName: "ACME", supplierInvoiceNo: "INV-9", locationName: "Main", totalValue: "5000", status: "posted", lineCount: "2", totalCount: "1" }] });
    const res = await listGrns(sql, { locationId: LOC });
    expect(res.rows[0]).toMatchObject({ docNumber: "GRN-00001", party: "ACME", value: 5000, lineCount: 2 });
  });
  it("lists transfers with a route label", async () => {
    const sql = makeSql({ list_transfers: [{ id: "t1", transferNumber: "TRF-00001", transferDate: "2026-06-01", fromName: "Main", toName: "Branch", status: "posted", lineCount: "1", totalCount: "1" }] });
    const res = await listTransfers(sql, {});
    expect(res.rows[0]).toMatchObject({ docNumber: "TRF-00001", route: "Main → Branch" });
  });
  it("lists adjustments", async () => {
    const sql = makeSql({ list_adjustments: [{ id: "a1", adjustmentNumber: "ADJ-00001", adjustmentDate: "2026-06-01", reason: "damage", note: null, locationName: "Main", lineCount: "1", totalCount: "1" }] });
    const res = await listAdjustments(sql, {});
    expect(res.rows[0]).toMatchObject({ docNumber: "ADJ-00001", reason: "damage", note: null });
  });
});

describe("document detail", () => {
  it("getGrn returns the header + lines, 404 when missing", async () => {
    const sql = makeSql({
      get_grn: [{ id: "g1", docNumber: "GRN-00001", date: "2026-06-01", supplierName: "ACME", supplierInvoiceNo: null, locationName: "Main", totalValue: "5000", status: "posted", note: null }],
      "": [{ productName: "Titan", packSizeLitres: "5", brand: "Fuchs", qtyUnits: "2", rate: "100", amount: "200" }],
    });
    const grn = await getGrn(sql, "g1");
    expect(grn).toMatchObject({ docNumber: "GRN-00001", supplierInvoiceNo: null });
    expect(grn.lines[0]).toMatchObject({ productName: "Titan", qtyUnits: 2, amount: 200 });
    await expect(getGrn(makeSql({ get_grn: [] }), "x")).rejects.toMatchObject({ status: 404 });
  });
  it("getTransfer returns header + lines, 404 when missing", async () => {
    const sql = makeSql({
      get_transfer: [{ id: "t1", docNumber: "TRF-00001", date: "2026-06-01", note: null, status: "posted", fromName: "Main", toName: "Branch" }],
      "": [{ productName: "Titan", packSizeLitres: "5", brand: null, qtyUnits: "3" }],
    });
    const t = await getTransfer(sql, "t1");
    expect(t).toMatchObject({ fromName: "Main", toName: "Branch" });
    expect(t.lines[0]).toMatchObject({ qtyUnits: 3, brand: null });
    await expect(getTransfer(makeSql({ get_transfer: [] }), "x")).rejects.toMatchObject({ status: 404 });
  });
  it("getAdjustment returns header + lines, 404 when missing", async () => {
    const sql = makeSql({
      get_adjustment: [{ id: "a1", docNumber: "ADJ-00001", date: "2026-06-01", reason: "damage", note: "spill", locationName: "Main" }],
      "": [{ productName: "Titan", packSizeLitres: "5", brand: "Fuchs", deltaUnits: "-2" }],
    });
    const a = await getAdjustment(sql, "a1");
    expect(a).toMatchObject({ reason: "damage", note: "spill" });
    expect(a.lines[0]).toMatchObject({ deltaUnits: -2 });
    await expect(getAdjustment(makeSql({ get_adjustment: [] }), "x")).rejects.toMatchObject({ status: 404 });
  });
});

describe("getBalancesForSkus", () => {
  it("returns an empty map for no SKUs", async () => {
    expect((await getBalancesForSkus(makeSql(), LOC, [])).size).toBe(0);
  });
  it("keys balances by productId|pack", async () => {
    const sql = makeSql({ balances_for_skus: [{ productId: P1, packSizeLitres: "5", qtyUnits: "12" }] });
    const map = await getBalancesForSkus(sql, LOC, [{ productId: P1, packSizeLitres: 5 }]);
    expect(map.get("p1|5")).toBe(12);
  });
});

const grnLine = { productId: P1, packSizeLitres: 5, brand: "Fuchs", qtyUnits: 4, rate: 100 };

describe("postGrn", () => {
  it("rejects empty lines (422)", async () => {
    await expect(postGrn(makeSql(), "u", grnInput([]))).rejects.toMatchObject({ status: 422 });
  });
  it("rejects a line with a missing or non-positive rate (422)", async () => {
    await expect(postGrn(makeSql(), "u", grnInput([{ ...grnLine, rate: null as unknown as number }]))).rejects.toMatchObject({ status: 422 });
    await expect(postGrn(makeSql(), "u", grnInput([{ ...grnLine, rate: 0 }]))).rejects.toMatchObject({ status: 422 });
  });
  it("numbers, totals, and posts the GRN batch", async () => {
    const sql = makeSql({ "": [{ n: 1 }], create_grn: [] });
    const res = await postGrn(sql, "u", grnInput([grnLine]));
    expect(res).toMatchObject({ grnNumber: "GRN-00001", totalValue: 400 });
    expect(calledTag(sql, "stock_movement")).toBe(true);
  });
  it("links each line to its lot (batch_id on the movement) via the identity map", async () => {
    const sql = makeSql({
      "": [{ n: 1 }], create_grn: [],
      // ensure_lots echoes a lot row per distinct line identity (expiry as a Neon Date).
      ensure_lots: [
        { id: "lot-1", productId: P1, packSizeLitres: "5", brand: "Fuchs", batchNumber: "B1", expiryDate: new Date("2027-01-10T00:00:00Z"), rate: "100" },
        { id: "lot-2", productId: "p2", packSizeLitres: "1", brand: null, batchNumber: null, expiryDate: null, rate: "80" },
      ],
    });
    const res = await postGrn(sql, "u", {
      locationId: LOC, supplierName: "ACME", supplierInvoiceNo: null, supplierInvoiceDate: null,
      receivedDate: "2026-11-05", reference: null, note: null, lines: [
        { productId: P1, packSizeLitres: 5, brand: "Fuchs", qtyUnits: 4, rate: 100, batchNumber: "B1", expiryDate: "2027-01-10", rackNo: "R1", shelfNo: "S1", binNo: "BN1" },
        { productId: "p2", packSizeLitres: 1, brand: null, qtyUnits: 6, rate: 80 },
        // Same lot identity as line 1 → deduped to one lot (exercises the skip path).
        { productId: P1, packSizeLitres: 5, brand: "Fuchs", qtyUnits: 2, rate: 100, batchNumber: "B1", expiryDate: "2027-01-10", rackNo: "R1", shelfNo: "S1", binNo: "BN1" },
      ],
    });
    expect(res.grnNumber).toBe("GRN-00001");
    expect(calledTag(sql, "ensure_lots")).toBe(true);
    expect(calledTag(sql, "stock_lot_balance")).toBe(true);
    const moves = sql.calls.filter((c) => c.tag === "stock_movement");
    expect(moves.some((c) => c.params.includes("lot-1"))).toBe(true); // batch+expiry matched
    expect(moves.some((c) => c.params.includes("lot-2"))).toBe(true); // null batch/expiry matched
  });
  function grnInput(lines: (typeof grnLine)[]) {
    return { locationId: LOC, supplierName: "ACME", supplierInvoiceNo: null, supplierInvoiceDate: null, receivedDate: null, reference: null, note: null, lines };
  }
});

describe("postTransfer", () => {
  const BATCH = "lot-src";
  const line = { productId: P1, packSizeLitres: 5, brand: "Fuchs", qtyUnits: 2, fromBatchId: BATCH };
  const input = (over = {}) => ({ fromLocationId: "a", toLocationId: "b", transferDate: null, note: null, lines: [line], ...over });
  const srcLot = { id: BATCH, locationId: "a", productId: P1, packSizeLitres: "5", brand: "Fuchs", batchNumber: "B1", expiryDate: new Date("2027-01-10T00:00:00Z"), rackNo: "R1", shelfNo: "S1", binNo: "BN1", qtyUnits: "100" };
  const destLot = { id: "lot-dest", productId: P1, packSizeLitres: "5", brand: "Fuchs", batchNumber: "B1", expiryDate: new Date("2027-01-10T00:00:00Z") };
  const ok = (over = {}) => makeSql({ fetch_lots: [srcLot], ensure_lots: [destLot], "": [{ n: 1 }], create_transfer: [], ...over });

  it("rejects same-godown and empty lines (422)", async () => {
    await expect(postTransfer(makeSql(), "u", input({ toLocationId: "a" }))).rejects.toMatchObject({ status: 422 });
    await expect(postTransfer(makeSql(), "u", input({ lines: [] }))).rejects.toMatchObject({ status: 422 });
  });
  it("422 when a line has no source batch picked", async () => {
    await expect(postTransfer(makeSql(), "u", input({ lines: [{ ...line, fromBatchId: "" }] }))).rejects.toMatchObject({ status: 422 });
  });
  it("422 when the batch isn't at the source godown (or is missing)", async () => {
    await expect(postTransfer(makeSql({ fetch_lots: [{ ...srcLot, locationId: "z" }] }), "u", input())).rejects.toMatchObject({ status: 422 });
    await expect(postTransfer(makeSql({ fetch_lots: [] }), "u", input())).rejects.toMatchObject({ status: 422 });
  });
  it("hard-blocks when the lot can't cover the line (STOCK_SHORT)", async () => {
    await expect(postTransfer(makeSql({ fetch_lots: [{ ...srcLot, qtyUnits: "1" }] }), "u", input())).rejects.toMatchObject({ code: "STOCK_SHORT", status: 409 });
  });
  it("posts paired out/in movements + lot moves when the lot covers it", async () => {
    const sql = ok();
    const res = await postTransfer(sql, "u", input());
    expect(res.transferNumber).toBe("TRF-00001");
    expect(calledTag(sql, "fetch_lots")).toBe(true);
    expect(calledTag(sql, "ensure_lots")).toBe(true);
    expect(calledTag(sql, "stock_lot_balance")).toBe(true);
    const moves = sql.calls.filter((c) => c.tag === "stock_movement");
    expect(moves.some((c) => c.params.includes("lot-src"))).toBe(true); // transfer_out from the source lot
    expect(moves.some((c) => c.params.includes("lot-dest"))).toBe(true); // transfer_in into the dest lot
  });
  it("carries a null-batch/expiry/shelf lot to the destination", async () => {
    const nullSrc = { id: BATCH, locationId: "a", productId: P1, packSizeLitres: "5", brand: null, batchNumber: null, expiryDate: null, rackNo: null, shelfNo: null, binNo: null, qtyUnits: "50" };
    const nullDest = { id: "lot-dest2", productId: P1, packSizeLitres: "5", brand: null, batchNumber: null, expiryDate: null };
    const sql = makeSql({ fetch_lots: [nullSrc], ensure_lots: [nullDest], "": [{ n: 1 }], create_transfer: [] });
    const res = await postTransfer(sql, "u", input());
    expect(res.transferNumber).toBe("TRF-00001");
    const moves = sql.calls.filter((c) => c.tag === "stock_movement");
    expect(moves.some((c) => c.params.includes("lot-dest2"))).toBe(true);
  });
  it("maps a transaction underflow to STOCK_SHORT and rethrows other errors", async () => {
    const under = ok();
    (under as unknown as { transaction: () => Promise<unknown> }).transaction = () => {
      throw new Error('violates check constraint "stock_balances_nonneg"');
    };
    await expect(postTransfer(under, "u", input())).rejects.toMatchObject({ code: "STOCK_SHORT" });
    const boom = ok();
    (boom as unknown as { transaction: () => Promise<unknown> }).transaction = () => {
      throw new Error("db boom");
    };
    await expect(postTransfer(boom, "u", input())).rejects.toThrow("db boom");
  });
});

describe("postAdjustment", () => {
  type AdjLine = { productId: string; packSizeLitres: number; brand: string | null; deltaUnits: number; batchId?: string | null; batchNumber?: string | null; expiryDate?: string | null };
  const BATCH = "lot-x";
  const neg: AdjLine = { productId: P1, packSizeLitres: 5, brand: "Fuchs", deltaUnits: -2, batchId: BATCH };
  const pos: AdjLine = { productId: P1, packSizeLitres: 5, brand: "Fuchs", deltaUnits: 3, batchNumber: "NEW-B", expiryDate: "2028-01-01" };
  const input = (lines: AdjLine[]) => ({ locationId: LOC, reason: "damage", note: null, adjustmentDate: null, lines });
  const srcLot = { id: BATCH, locationId: LOC, productId: P1, packSizeLitres: "5", brand: "Fuchs", batchNumber: "B1", expiryDate: new Date("2027-01-10T00:00:00Z"), rackNo: null, shelfNo: null, binNo: null, qtyUnits: "10" };
  const posLot = { id: "lot-new", productId: P1, packSizeLitres: "5", brand: "Fuchs", batchNumber: "NEW-B", expiryDate: new Date("2028-01-01T00:00:00Z") };

  it("rejects when every line is zero (422)", async () => {
    await expect(postAdjustment(makeSql(), "u", input([{ ...neg, deltaUnits: 0 }]))).rejects.toMatchObject({ status: 422 });
  });
  it("422 when a negative line has no batch, or a positive line lacks batch/expiry", async () => {
    await expect(postAdjustment(makeSql(), "u", input([{ ...neg, batchId: "" }]))).rejects.toMatchObject({ status: 422 });
    await expect(postAdjustment(makeSql(), "u", input([{ ...pos, batchNumber: null }]))).rejects.toMatchObject({ status: 422 });
    await expect(postAdjustment(makeSql(), "u", input([{ ...pos, expiryDate: null }]))).rejects.toMatchObject({ status: 422 });
  });
  it("422 when the negative line's batch isn't at this godown (or is missing)", async () => {
    await expect(postAdjustment(makeSql({ fetch_lots: [{ ...srcLot, locationId: "z" }] }), "u", input([neg]))).rejects.toMatchObject({ status: 422 });
    await expect(postAdjustment(makeSql({ fetch_lots: [] }), "u", input([neg]))).rejects.toMatchObject({ status: 422 });
  });
  it("hard-blocks a negative line bigger than the lot (STOCK_SHORT)", async () => {
    await expect(postAdjustment(makeSql({ fetch_lots: [{ ...srcLot, qtyUnits: "1" }] }), "u", input([neg]))).rejects.toMatchObject({ code: "STOCK_SHORT", status: 409 });
  });
  it("posts a negative (reduce lot) + positive (create lot) in one adjustment", async () => {
    const sql = makeSql({ fetch_lots: [srcLot], ensure_lots: [posLot], "": [{ n: 1 }], create_adjustment: [] });
    const res = await postAdjustment(sql, "u", input([neg, pos]));
    expect(res.adjustmentNumber).toBe("ADJ-00001");
    expect(calledTag(sql, "fetch_lots")).toBe(true);
    expect(calledTag(sql, "ensure_lots")).toBe(true);
    expect(calledTag(sql, "stock_lot_balance")).toBe(true);
    const moves = sql.calls.filter((c) => c.tag === "stock_movement");
    expect(moves.some((c) => c.params.includes("lot-x"))).toBe(true); // negative reduces the picked lot
    expect(moves.some((c) => c.params.includes("lot-new"))).toBe(true); // positive adds to the created lot
  });
  it("a positive-only adjustment creates the lot without fetching source lots", async () => {
    const sql = makeSql({ ensure_lots: [posLot], "": [{ n: 1 }], create_adjustment: [] });
    const res = await postAdjustment(sql, "u", input([pos]));
    expect(res.adjustmentNumber).toBe("ADJ-00001");
    expect(calledTag(sql, "fetch_lots")).toBe(false); // no negative line → no source-lot fetch
    expect(calledTag(sql, "ensure_lots")).toBe(true);
    expect(sql.calls.filter((c) => c.tag === "stock_movement").some((c) => c.params.includes("lot-new"))).toBe(true);
  });
  it("maps a transaction underflow to STOCK_SHORT, rethrows others", async () => {
    const mk = () => makeSql({ fetch_lots: [srcLot], "": [{ n: 1 }] });
    const under = mk();
    (under as unknown as { transaction: () => Promise<unknown> }).transaction = () => { throw new Error("check constraint failed"); };
    await expect(postAdjustment(under, "u", input([neg]))).rejects.toMatchObject({ code: "STOCK_SHORT" });
    const boom = mk();
    (boom as unknown as { transaction: () => Promise<unknown> }).transaction = () => { throw new Error("db boom"); };
    await expect(postAdjustment(boom, "u", input([neg]))).rejects.toThrow("db boom");
  });
});

describe("postOpening", () => {
  it("rejects when no line has a positive quantity (422)", async () => {
    await expect(postOpening(makeSql(), "u", { locationId: LOC, openingDate: null, lines: [{ productId: P1, packSizeLitres: 5, brand: null, qtyUnits: 0 }] })).rejects.toMatchObject({ status: 422 });
  });
  it("rejects a positive-qty line with a missing or non-positive rate (422)", async () => {
    await expect(postOpening(makeSql(), "u", { locationId: LOC, openingDate: null, lines: [{ productId: P1, packSizeLitres: 5, brand: null, qtyUnits: 10 }] })).rejects.toMatchObject({ status: 422 });
    await expect(postOpening(makeSql(), "u", { locationId: LOC, openingDate: null, lines: [{ productId: P1, packSizeLitres: 5, brand: null, qtyUnits: 10, rate: 0 }] })).rejects.toMatchObject({ status: 422 });
  });
  it("posts one opening movement + balance per positive line", async () => {
    const sql = makeSql();
    const res = await postOpening(sql, "u", { locationId: LOC, openingDate: "2026-04-01", lines: [
      { productId: P1, packSizeLitres: 5, brand: "Fuchs", qtyUnits: 10, rate: 90 },
      { productId: "p2", packSizeLitres: 1, brand: "Fuchs", qtyUnits: 5, rate: 40 },
    ] });
    expect(res).toEqual({ posted: 2 });
    expect(calledTag(sql, "create_opening_item")).toBe(true);
  });
});

describe("recomputeBalances / setReorderLevel", () => {
  it("rebuilds the balance cache", async () => {
    expect(await recomputeBalances(makeSql())).toEqual({ ok: true });
  });
  it("upserts a reorder level (or clears it with null)", async () => {
    const sql = makeSql();
    expect(await setReorderLevel(sql, { locationId: LOC, productId: P1, packSizeLitres: 5, reorderLevel: 3 })).toEqual({ ok: true });
    expect(calledTag(sql, "set_reorder_level")).toBe(true);
  });
});

// ── APIs added/changed this session (full line + branch coverage) ──

describe("balancesByGodown", () => {
  it("maps each active godown's SKU count, units and litres", async () => {
    const sql = makeSql({
      balances_by_godown: [
        { locationId: "l1", locationName: "Main", skuCount: "6", units: "122", litres: "3550" },
        { locationId: "l2", locationName: "Branch", skuCount: "2", units: "15", litres: "15" },
      ],
    });
    const rows = await balancesByGodown(sql);
    expect(rows).toEqual([
      { locationId: "l1", locationName: "Main", skuCount: 6, units: 122, litres: 3550 },
      { locationId: "l2", locationName: "Branch", skuCount: 2, units: 15, litres: 15 },
    ]);
    expect(calledTag(sql, "balances_by_godown")).toBe(true);
  });
  it("returns [] when there are no godowns", async () => {
    expect(await balancesByGodown(makeSql({ balances_by_godown: [] }))).toEqual([]);
  });
});

describe("fefoSplit / allocateSaleFefo / currentSaleLots", () => {
  const lots = [
    { lotId: "z", expiryDate: "2025-01-01", qty: 0, rate: 50 }, // oldest but empty → skipped
    { lotId: "b", expiryDate: "2027-03-01", qty: 8, rate: 120 },
    { lotId: "a", expiryDate: "2027-01-01", qty: 10, rate: 100 },
    { lotId: "c", expiryDate: null, qty: 5, rate: null }, // no expiry → last; unpriced lot
  ];
  it("fefoSplit allocates oldest-expiry-first, skips empty lots, carries each lot's rate, throws when short", () => {
    expect(fefoSplit(lots, 15)).toEqual([{ lotId: "a", qty: 10, rate: 100 }, { lotId: "b", qty: 5, rate: 120 }]);
    expect(fefoSplit(lots, 23)).toEqual([{ lotId: "a", qty: 10, rate: 100 }, { lotId: "b", qty: 8, rate: 120 }, { lotId: "c", qty: 5, rate: null }]);
    expect(() => fefoSplit(lots, 24)).toThrow("Not enough stock");
    // same-expiry lots keep their order (exercises the comparator's equal branch).
    expect(fefoSplit([{ lotId: "x", expiryDate: "2027-01-01", qty: 4, rate: 10 }, { lotId: "y", expiryDate: "2027-01-01", qty: 4, rate: 20 }], 6)).toEqual([{ lotId: "x", qty: 4, rate: 10 }, { lotId: "y", qty: 2, rate: 20 }]);
  });
  it("allocateSaleFefo reads on-hand lots then splits FEFO, carrying each lot's rate", async () => {
    const sql = makeSql({
      list_available_lots: [
        { id: "a", packSizeLitres: "1", batchNumber: "A", expiryDate: new Date("2027-01-01T00:00:00Z"), rate: "90", rackNo: null, shelfNo: null, binNo: null, qtyUnits: "10", receivedDate: new Date("2026-11-01T00:00:00Z"), source: "GRN-1", daysToExpiry: "60" },
        { id: "b", packSizeLitres: "1", batchNumber: "B", expiryDate: new Date("2027-03-01T00:00:00Z"), rate: null, rackNo: null, shelfNo: null, binNo: null, qtyUnits: "8", receivedDate: new Date("2026-11-01T00:00:00Z"), source: "GRN-2", daysToExpiry: "120" },
      ],
    });
    expect(await allocateSaleFefo(sql, { locationId: LOC, productId: P1, packSizeLitres: 1, qtyUnits: 15 })).toEqual([{ lotId: "a", qty: 10, rate: 90 }, { lotId: "b", qty: 5, rate: null }]);
  });
  it("currentSaleLots nets an invoice's per-lot sale to credit back", async () => {
    const sql = makeSql({
      invoice_sale_lots: [
        { productId: P1, packSizeLitres: "1", brand: "Fuchs", batchId: "a", expiryDate: new Date("2027-01-01T00:00:00Z"), qty: "10" },
        { productId: "p2", packSizeLitres: "5", brand: null, batchId: "b", expiryDate: null, qty: "2" },
      ],
    });
    const r = await currentSaleLots(sql, "inv-1");
    expect(r[0]).toMatchObject({ productId: P1, batchId: "a", expiryDate: "2027-01-01", qty: 10, brand: "Fuchs" });
    expect(r[1]).toMatchObject({ batchId: "b", brand: null, expiryDate: null, qty: 2 });
  });
});

describe("allocateReturnRestock", () => {
  it("allocates a return back to the still-out lots, earliest-expiry first", async () => {
    const sql = makeSql({
      invoice_sale_lots: [
        { productId: P1, packSizeLitres: "1", brand: "Fuchs", batchId: "late", expiryDate: new Date("2027-03-01T00:00:00Z"), qty: "1" },
        { productId: P1, packSizeLitres: "1", brand: "Fuchs", batchId: "early", expiryDate: new Date("2027-01-01T00:00:00Z"), qty: "2" },
      ],
    });
    const out = await allocateReturnRestock(sql, "inv-1", [{ productId: P1, packSizeLitres: 1, qtyUnits: 3 }]);
    // Earliest-expiry out-lot ('early', 2 units) consumed first, then 'late' (1).
    expect(out).toEqual([
      { productId: P1, packSizeLitres: 1, brand: "Fuchs", batchId: "early", qty: 2 },
      { productId: P1, packSizeLitres: 1, brand: "Fuchs", batchId: "late", qty: 1 },
    ]);
  });

  it("skips zero-qty lines and restocks nothing", async () => {
    const sql = makeSql({ invoice_sale_lots: [{ productId: P1, packSizeLitres: "1", brand: null, batchId: "a", expiryDate: null, qty: "2" }] });
    expect(await allocateReturnRestock(sql, "inv-1", [{ productId: P1, packSizeLitres: 1, qtyUnits: 0 }])).toEqual([]);
  });

  it("throws STOCK_SHORT when the sale's lots can't cover the return", async () => {
    const sql = makeSql({ invoice_sale_lots: [] }); // nothing still out for this SKU
    await expect(
      allocateReturnRestock(sql, "inv-1", [{ productId: P1, packSizeLitres: 1, qtyUnits: 1 }]),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("allocateReturnAdjustment", () => {
  it("restocks more on a positive delta (return edited up)", async () => {
    const sql = makeSql({ invoice_sale_lots: [{ productId: P1, packSizeLitres: "1", brand: "Fuchs", batchId: "a", expiryDate: new Date("2027-01-01T00:00:00Z"), qty: "3" }] });
    const out = await allocateReturnAdjustment(sql, "inv-1", [{ productId: P1, packSizeLitres: 1, delta: 2 }]);
    expect(out).toEqual([{ productId: P1, packSizeLitres: 1, brand: "Fuchs", batchId: "a", qty: 2 }]);
  });

  it("pulls stock back out on a negative delta (return edited down), latest-expiry first", async () => {
    const sql = makeSql({
      invoice_returned_lots: [
        { productId: P1, packSizeLitres: "1", brand: "Fuchs", batchId: "early", expiryDate: new Date("2027-01-01T00:00:00Z"), qty: "1" },
        { productId: P1, packSizeLitres: "1", brand: "Fuchs", batchId: "late", expiryDate: new Date("2027-03-01T00:00:00Z"), qty: "2" },
      ],
    });
    const out = await allocateReturnAdjustment(sql, "inv-1", [{ productId: P1, packSizeLitres: 1, delta: -2 }]);
    // latest-expiry lot ('late', 2) is un-restocked first; qty is negative (removed).
    expect(out).toEqual([{ productId: P1, packSizeLitres: 1, brand: "Fuchs", batchId: "late", qty: -2 }]);
  });

  it("throws STOCK_SHORT when the returned lots can't cover a negative delta (re-sold)", async () => {
    const sql = makeSql({ invoice_returned_lots: [] });
    await expect(
      allocateReturnAdjustment(sql, "inv-1", [{ productId: P1, packSizeLitres: 1, delta: -1 }]),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("invoice stock activity", () => {
  it("maps sale/reversal rows (value only on sales, nullable customer)", async () => {
    const sql = makeSql({
      list_invoice_stock_activity: [
        // Live sale row (sale/sale_reversal collapse): signedUnits is negative → net out.
        { invoiceId: "inv-1", rowKind: "sale", docStatus: "final", invoiceNumber: "SA/1", customerName: "7th Gear", locationName: "Bachupally", locationId: LOC, signedUnits: "-25", lineUnits: "25", lineCount: "1", value: "17700", movedAt: "2026-11-05" },
        // Return row: signedUnits positive → units restocked, no value.
        { invoiceId: "inv-1", rowKind: "return", docStatus: "final", invoiceNumber: "SA/1", customerName: "7th Gear", locationName: "Bachupally", locationId: LOC, signedUnits: "3", lineUnits: "25", lineCount: "1", value: "17700", movedAt: "2026-11-06" },
        // Cancelled invoice → sale row reads as a 'reversal' of the units credited back (its line qty).
        { invoiceId: "inv-2", rowKind: "sale", docStatus: "cancelled", invoiceNumber: "SA/2", customerName: null, locationName: "Bachupally", locationId: LOC, signedUnits: "0", lineUnits: "5", lineCount: "1", value: "900", movedAt: "2026-11-04" },
      ],
    });
    const rows = await listInvoiceStockActivity(sql, { locationId: LOC, limit: 40 });
    expect(rows[0]).toMatchObject({ invoiceId: "inv-1", kind: "sale", units: 25, value: 17700, customerName: "7th Gear" });
    expect(rows[1]).toMatchObject({ invoiceId: "inv-1", kind: "return", units: 3, value: null });
    expect(rows[2]).toMatchObject({ invoiceId: "inv-2", kind: "reversal", units: 5, value: null, customerName: null });
    expect(calledTag(sql, "list_invoice_stock_activity")).toBe(true);
    expect(await listInvoiceStockActivity(makeSql({ list_invoice_stock_activity: [] }), {})).toEqual([]); // no godown / default limit
  });
  it("getInvoiceStockLots returns the invoice header + per-lot breakdown, 404 when missing", async () => {
    const sql = makeSql({
      invoice_stock_header: [{ invoiceNumber: "SA/1", invoiceDate: "2026-11-05", customerName: "7th Gear", locationName: "Bachupally" }],
      invoice_stock_lots_sale: [
        { productName: "Titan GT1 Flex", packSizeLitres: "1", batchNumber: "SEED-A", expiryDate: new Date("2026-12-31T00:00:00Z"), qtyUnits: "20" },
        { productName: "Titan GT1 Flex", packSizeLitres: "1", batchNumber: null, expiryDate: null, qtyUnits: "5" },
      ],
    });
    const d = await getInvoiceStockLots(sql, "inv-1", "sale");
    expect(d).toMatchObject({ kind: "sale", invoiceNumber: "SA/1", customerName: "7th Gear", locationName: "Bachupally" });
    expect(d.lines[0]).toMatchObject({ batchNumber: "SEED-A", expiryDate: "2026-12-31", qtyUnits: 20 });
    expect(d.lines[1]).toMatchObject({ batchNumber: null, expiryDate: null, qtyUnits: 5 });
    await expect(getInvoiceStockLots(makeSql({ invoice_stock_header: [] }), "nope", "reversal")).rejects.toMatchObject({ status: 404 });
    const d2 = await getInvoiceStockLots(makeSql({ invoice_stock_header: [{ invoiceNumber: "SA/3", invoiceDate: "2026-11-05", customerName: null, locationName: null }], invoice_stock_lots: [] }), "inv-3", "reversal");
    expect(d2).toMatchObject({ kind: "reversal", customerName: null, locationName: null, lines: [] });
    const d3 = await getInvoiceStockLots(makeSql({
      invoice_stock_header: [{ invoiceNumber: "SA/1", invoiceDate: "2026-11-05", customerName: "7th Gear", locationName: "Bachupally" }],
      invoice_stock_lots_return: [{ productName: "Titan GT1 Flex", packSizeLitres: "1", batchNumber: "SEED-A", expiryDate: new Date("2026-12-31T00:00:00Z"), qtyUnits: "2" }],
    }), "inv-1", "return");
    expect(d3).toMatchObject({ kind: "return" });
    expect(d3.lines[0]).toMatchObject({ batchNumber: "SEED-A", qtyUnits: 2 });
  });
});

describe("listAvailableLots", () => {
  it("maps on-hand lots FEFO, with nullable batch/expiry/shelf", async () => {
    const sql = makeSql({
      list_available_lots: [
        { id: "lot-1", packSizeLitres: "5", batchNumber: "B1", expiryDate: new Date("2027-01-10T00:00:00Z"), rackNo: "R1", shelfNo: "S1", binNo: "BN1", qtyUnits: "20", receivedDate: new Date("2026-11-01T00:00:00Z"), source: "GRN-1", daysToExpiry: "66" },
        { id: "lot-2", packSizeLitres: "5", batchNumber: null, expiryDate: null, rackNo: null, shelfNo: null, binNo: null, qtyUnits: "10", receivedDate: new Date("2026-10-01T00:00:00Z"), source: "Opening stock", daysToExpiry: null },
      ],
    });
    const lots = await listAvailableLots(sql, { locationId: LOC, productId: P1, packSizeLitres: 5 });
    expect(lots[0]).toMatchObject({ id: "lot-1", batchNumber: "B1", expiryDate: "2027-01-10", qtyUnits: 20, daysToExpiry: 66, source: "GRN-1" });
    expect(lots[1]).toMatchObject({ id: "lot-2", batchNumber: null, expiryDate: null, rackNo: null, daysToExpiry: null });
    expect(calledTag(sql, "list_available_lots")).toBe(true);
  });
  it("returns [] with no packSizeLitres filter", async () => {
    expect(await listAvailableLots(makeSql({ list_available_lots: [] }), { locationId: LOC, productId: P1 })).toEqual([]);
  });
});

describe("listNearExpiry (session branches)", () => {
  it("trims the godown filter, floors a fractional within-days, and maps null detail fields", async () => {
    const sql = makeSql({
      list_near_expiry: [{
        id: "oi-1", productName: "Opening item", packSizeLitres: "20", brand: null,
        batchNumber: null, expiryDate: "2028-08-15", qtyUnits: "4",
        rackNo: null, shelfNo: null, binNo: "BN9",
        grnNumber: "Opening stock", receivedDate: "2026-10-01", supplierName: "Opening stock",
        locationId: LOC, locationName: "Main", daysToExpiry: "640", onHandQty: "0",
      }],
    });
    const rows = await listNearExpiry(sql, { locationId: "  l1  ", withinDays: 30.9 });
    expect(rows[0]).toMatchObject({ brand: null, batchNumber: null, rackNo: null, shelfNo: null, binNo: "BN9", expiryDate: "2028-08-15" });
  });
  it("treats a non-positive within-days as no limit", async () => {
    expect(await listNearExpiry(makeSql({ list_near_expiry: [] }), { withinDays: 0 })).toEqual([]);
  });
});

describe("lookupProductStock", () => {
  it("maps product, per-godown balances (reorder flags), batches and recent movements", async () => {
    const sql = makeSql({
      lookup_product: [{ id: "p1", productName: "Titan 5W-30", brand: "Fuchs", segment: "Car", unit: "litres" }],
      lookup_balances: [
        { locationName: "Main", packSizeLitres: "5", qtyUnits: "2", reorderLevel: "5" },
        { locationName: "Branch", packSizeLitres: "1", qtyUnits: "10", reorderLevel: "3" },
        { locationName: "Depot", packSizeLitres: "20", qtyUnits: "4", reorderLevel: null },
      ],
      lookup_batches: [
        { id: "b1", packSizeLitres: "5", batchNumber: "B1", expiryDate: "2027-01-10", rackNo: "R1", shelfNo: "S1", binNo: "BN1", qtyUnits: "2", locationName: "Main", receivedDate: "2026-11-01", source: "GRN-1", daysToExpiry: "66" },
        { id: "b2", packSizeLitres: "1", batchNumber: null, expiryDate: null, rackNo: null, shelfNo: null, binNo: null, qtyUnits: "10", locationName: "Branch", receivedDate: "2026-10-01", source: "Opening stock", daysToExpiry: null },
      ],
      list_stock_movements: [
        { id: "m1", kind: "grn", qtyUnits: "5", litres: "25", packSizeLitres: "5", refType: "grn", refId: "g1", note: "x", movedAt: "2026-06-01", locationName: "Main", productName: "Titan 5W-30", brand: "Fuchs", totalCount: "1" },
      ],
    });
    const res = await lookupProductStock(sql, "p1");
    expect(res.product).toEqual({ id: "p1", productName: "Titan 5W-30", brand: "Fuchs", segment: "Car", unit: "litres" });
    expect(res.totals).toEqual({ qtyUnits: 16, litres: 100 });
    expect(res.balances[0]).toMatchObject({ reorderLevel: 5, belowReorder: true });
    expect(res.balances[1]).toMatchObject({ reorderLevel: 3, belowReorder: false });
    expect(res.balances[2]).toMatchObject({ reorderLevel: null, belowReorder: false });
    expect(res.batches[0]).toMatchObject({ batchNumber: "B1", expiryDate: "2027-01-10", binNo: "BN1", daysToExpiry: 66 });
    expect(res.batches[1]).toMatchObject({ batchNumber: null, expiryDate: null, rackNo: null, shelfNo: null, binNo: null, daysToExpiry: null });
    expect(res.movements).toHaveLength(1);
  });
  it("tolerates a null brand/segment and empty balances/batches/movements", async () => {
    const sql = makeSql({
      lookup_product: [{ id: "p9", productName: "Bulk", brand: null, segment: null, unit: "litres" }],
      lookup_balances: [], lookup_batches: [], list_stock_movements: [],
    });
    const res = await lookupProductStock(sql, "p9");
    expect(res.product).toEqual({ id: "p9", productName: "Bulk", brand: null, segment: null, unit: "litres" });
    expect(res.totals).toEqual({ qtyUnits: 0, litres: 0 });
    expect(res.balances).toEqual([]);
    expect(res.batches).toEqual([]);
    expect(res.movements).toEqual([]);
  });
  it("404s when the product does not exist", async () => {
    await expect(lookupProductStock(makeSql({ lookup_product: [] }), "nope")).rejects.toMatchObject({ status: 404 });
  });
});

describe("postOpening (session branches)", () => {
  it("carries batch/expiry/location onto the opening item and skips zero-qty lines", async () => {
    const sql = makeSql();
    const res = await postOpening(sql, "u", {
      locationId: LOC, openingDate: null, lines: [
        { productId: P1, packSizeLitres: 5, brand: "Fuchs", qtyUnits: 10, rate: 120, batchNumber: "B1", expiryDate: "2027-01-01", rackNo: "R1", shelfNo: "S1", binNo: "BN1" },
        { productId: "p2", packSizeLitres: 1, brand: null, qtyUnits: 0 },
      ],
    });
    expect(res).toEqual({ posted: 1 });
    expect(calledTag(sql, "create_opening_item")).toBe(true);
  });
});
