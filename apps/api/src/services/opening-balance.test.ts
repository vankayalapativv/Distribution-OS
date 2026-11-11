import { describe, expect, it, vi } from "vitest";
import {
  applyAllocationToOpening,
  clearOpeningBalance,
  getOpeningBalance,
  getOpeningTarget,
  reverseAllocationFromOpening,
  upsertOpeningBalance,
} from "./opening-balance";
import { makeSql, calledTag } from "../test/sql-mock";

const CUST = "cust-1";
const OB_ROW = {
  id: "ob-1",
  customerId: CUST,
  asOfDate: new Date("2026-04-01T00:00:00Z"),
  openingAmount: "5000",
  amountCollected: "1000",
  outstandingAmount: "4000",
  remarks: "carry fwd",
  createdAt: null, // exercises str()'s null → "" fallback
  updatedAt: new Date("2026-04-02T00:00:00Z"),
};

describe("getOpeningBalance", () => {
  it("maps the row (date sliced to yyyy-mm-dd) or returns null", async () => {
    const found = await getOpeningBalance(makeSql({ get_opening_balance: [OB_ROW] }), CUST);
    expect(found).toMatchObject({ id: "ob-1", asOfDate: "2026-04-01", openingAmount: 5000, outstandingAmount: 4000 });
    expect(await getOpeningBalance(makeSql({ get_opening_balance: [] }), CUST)).toBeNull();
  });
});

describe("getOpeningTarget", () => {
  it("returns id + outstanding when there is a live opening, else null", async () => {
    const t = await getOpeningTarget(makeSql({ get_opening_target: [{ id: "ob-1", outstanding: "4000" }] }), CUST);
    expect(t).toEqual({ id: "ob-1", outstanding: 4000 });
    expect(await getOpeningTarget(makeSql({ get_opening_target: [] }), CUST)).toBeNull();
  });
});

describe("apply/reverse allocation", () => {
  it("runs the apply and reverse updates", async () => {
    const applySql = makeSql();
    await applyAllocationToOpening(applySql, "ob-1", 500);
    expect(calledTag(applySql, "apply_allocation_to_opening")).toBe(true);

    const revSql = makeSql();
    await reverseAllocationFromOpening(revSql, "ob-1", 500);
    expect(calledTag(revSql, "reverse_allocation_from_opening")).toBe(true);
  });
});

describe("upsertOpeningBalance", () => {
  const CTX_SA = { userId: "u1", role: "SUPER_ADMIN" as const };
  const CTX_ACC = { userId: "u2", role: "ACCOUNTANT" as const };
  const INPUT = { asOfDate: "2026-04-01", openingAmount: 5000, remarks: "x" };

  it("rejects a negative amount or a missing as-of date (422)", async () => {
    await expect(upsertOpeningBalance(makeSql(), CTX_SA, CUST, { ...INPUT, openingAmount: -1 }, vi.fn())).rejects.toMatchObject({ status: 422 });
    await expect(upsertOpeningBalance(makeSql(), CTX_SA, CUST, { ...INPUT, asOfDate: "" }, vi.fn())).rejects.toMatchObject({ status: 422 });
  });

  it("creates when none exists, re-reconciles, and returns the saved row", async () => {
    let reconciled = false;
    const reReconcile = vi.fn(async () => {
      reconciled = true;
    });
    const sql = makeSql({
      get_opening_balance: () => (reconciled ? [OB_ROW] : []),
      create_opening_balance: [],
    });
    const out = await upsertOpeningBalance(sql, CTX_ACC, CUST, INPUT, reReconcile);
    expect(reReconcile).toHaveBeenCalledOnce();
    expect(calledTag(sql, "create_opening_balance")).toBe(true);
    expect(out.id).toBe("ob-1");
  });

  it("forbids a non-super-admin editing an existing opening (403)", async () => {
    const sql = makeSql({ get_opening_balance: [OB_ROW] });
    await expect(upsertOpeningBalance(sql, CTX_ACC, CUST, INPUT, vi.fn())).rejects.toMatchObject({ status: 403 });
  });

  it("updates an existing opening as super-admin", async () => {
    const sql = makeSql({ get_opening_balance: [OB_ROW], update_opening_balance: [] });
    const reReconcile = vi.fn(async () => undefined);
    await upsertOpeningBalance(sql, CTX_SA, CUST, INPUT, reReconcile);
    expect(calledTag(sql, "update_opening_balance")).toBe(true);
    expect(reReconcile).toHaveBeenCalledOnce();
  });

  it("404s when the saved row cannot be read back", async () => {
    const sql = makeSql({ get_opening_balance: [], create_opening_balance: [] });
    await expect(upsertOpeningBalance(sql, CTX_SA, CUST, INPUT, vi.fn(async () => undefined))).rejects.toMatchObject({ status: 404 });
  });
});

describe("clearOpeningBalance", () => {
  const CTX_SA = { userId: "u1", role: "SUPER_ADMIN" as const };

  it("forbids a non-super-admin (403)", async () => {
    await expect(
      clearOpeningBalance(makeSql(), { userId: "u2", role: "ACCOUNTANT" }, CUST, vi.fn()),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("is a no-op (no re-reconcile) when there is no opening", async () => {
    const reReconcile = vi.fn();
    await clearOpeningBalance(makeSql({ get_opening_balance: [] }), CTX_SA, CUST, reReconcile);
    expect(reReconcile).not.toHaveBeenCalled();
  });

  it("drops allocations + row in one transaction, then re-reconciles", async () => {
    const sql = makeSql({ get_opening_balance: [OB_ROW] });
    const reReconcile = vi.fn(async () => undefined);
    await clearOpeningBalance(sql, CTX_SA, CUST, reReconcile);
    expect(calledTag(sql, "drop_opening_allocations")).toBe(true);
    expect(calledTag(sql, "delete_opening_balance")).toBe(true);
    expect(reReconcile).toHaveBeenCalledOnce();
  });
});
