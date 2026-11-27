import { afterEach, describe, expect, it, vi } from "vitest";
import { calledTag, makeSql } from "../test/sql-mock";
import { listPayables, markPaid, myReimbursements, perPersonBalances } from "./reimbursement-payables";

afterEach(() => vi.clearAllMocks());

const SE = "00000000-0000-4000-8000-000000000004";
const PID = "00000000-0000-4000-8000-000000000c01";

function payRow(over: Record<string, unknown> = {}) {
  return {
    id: PID, userId: SE, userName: "Priya", amount: "450", status: "owed",
    categoryName: "Fuel", code: "EXP-7", date: "2026-11-28",
    paymentMode: null, paidAt: null, createdAt: "2026-11-28T04:00:00.000Z", ...over,
  };
}

describe("listPayables", () => {
  it("defaults to owed and maps rows", async () => {
    const sql = makeSql({ list_payables: [payRow()] });
    const out = await listPayables(sql, "");
    expect(sql.calls.find((c) => c.tag === "list_payables")!.params).toEqual(["owed"]);
    expect(out[0]).toMatchObject({ id: PID, userName: "Priya", amount: 450, status: "owed", categoryName: "Fuel" });
  });
  it("honours an explicit status", async () => {
    const sql = makeSql({ list_payables: [] });
    await listPayables(sql, "paid");
    expect(sql.calls.find((c) => c.tag === "list_payables")!.params).toEqual(["paid"]);
  });
  it("coerces a Date createdAt and a missing amount", async () => {
    const sql = makeSql({ list_payables: [payRow({ createdAt: new Date("2026-11-28T04:00:00.000Z"), amount: undefined })] });
    const out = await listPayables(sql, "owed");
    expect(out[0].createdAt).toBe("2026-11-28T04:00:00.000Z");
    expect(out[0].amount).toBe(0);
  });
});

describe("perPersonBalances", () => {
  it("maps owed totals per person", async () => {
    const sql = makeSql({ reimbursement_balances: [{ userId: SE, userName: "Priya", owed: "450", owedCount: 2 }] });
    expect(await perPersonBalances(sql)).toEqual([{ userId: SE, userName: "Priya", owed: 450, owedCount: 2 }]);
  });
});

describe("myReimbursements", () => {
  it("returns the owed total (owed rows only) + the full list", async () => {
    const sql = makeSql({ my_reimbursements: [payRow(), payRow({ id: "p2", status: "paid", amount: "100" })] });
    const out = await myReimbursements(sql, SE);
    expect(out.owedTotal).toBe(450); // paid row excluded
    expect(out.payables).toHaveLength(2);
    expect(sql.calls.find((c) => c.tag === "my_reimbursements")!.params).toEqual([SE]);
  });
});

describe("markPaid", () => {
  it("404 when the payable is missing", async () => {
    await expect(markPaid(makeSql({ get_payable: [] }), "acc", PID, "cash")).rejects.toMatchObject({ status: 404 });
  });
  it("409 when it is not owed", async () => {
    await expect(markPaid(makeSql({ get_payable: [payRow({ status: "paid" })] }), "acc", PID, "cash"))
      .rejects.toMatchObject({ status: 409 });
  });
  it("settles an owed payable with a payment mode", async () => {
    const sql = makeSql({ get_payable: [payRow()] });
    await markPaid(sql, "acc", PID, "upi");
    const call = sql.calls.find((c) => c.tag === "mark_payable_paid")!;
    expect(call.params).toContain("upi");
    expect(calledTag(sql, "mark_payable_paid")).toBe(true);
  });
  it("settles with a null payment mode", async () => {
    const sql = makeSql({ get_payable: [payRow()] });
    await markPaid(sql, "acc", PID, null);
    expect(calledTag(sql, "mark_payable_paid")).toBe(true);
  });
});
