import { afterEach, describe, expect, it, vi } from "vitest";
import { calledTag, makeSql } from "../test/sql-mock";
import {
  approveAdvance,
  getAdvance,
  listAdvances,
  myAdvances,
  perPersonAdvanceBalances,
  recordAdvance,
  rejectAdvance,
  requestAdvance,
} from "./advances";

afterEach(() => vi.clearAllMocks());

const SE = "00000000-0000-4000-8000-000000000004";
const AID = "00000000-0000-4000-8000-000000000d01";

function advRow(over: Record<string, unknown> = {}) {
  return {
    id: AID, userId: SE, userName: "Priya", amount: "10000", source: "request", status: "requested",
    recoveryPlan: null, installmentAmount: null, outstanding: "0", reason: "medical", rejectReason: null,
    approvedAt: null, createdAt: "2026-11-28T04:00:00.000Z", ...over,
  };
}

describe("requestAdvance", () => {
  it("422 on a non-positive amount", async () => {
    await expect(requestAdvance(makeSql(), SE, 0, null)).rejects.toMatchObject({ status: 422 });
  });
  it("inserts a requested advance", async () => {
    const sql = makeSql({ request_advance: [{ id: AID }], get_advance: [advRow()] });
    const adv = await requestAdvance(sql, SE, 10000, "medical");
    expect(adv).toMatchObject({ id: AID, status: "requested", amount: 10000, outstanding: 0 });
    expect(calledTag(sql, "request_advance")).toBe(true);
  });
});

describe("recordAdvance", () => {
  const base = { userId: SE, amount: 10000, reason: null };
  it("422 on a bad amount or plan", async () => {
    await expect(recordAdvance(makeSql(), "off", { ...base, amount: 0, recoveryPlan: "full_next" })).rejects.toMatchObject({ status: 422 });
    await expect(recordAdvance(makeSql(), "off", { ...base, recoveryPlan: "weird" })).rejects.toMatchObject({ status: 422 });
    await expect(recordAdvance(makeSql(), "off", { ...base, recoveryPlan: "installment", installmentAmount: 0 })).rejects.toMatchObject({ status: 422 });
    await expect(recordAdvance(makeSql(), "off", { ...base, recoveryPlan: "installment", installmentAmount: 99999 })).rejects.toMatchObject({ status: 422 });
  });
  it("records a direct full-next advance (active, outstanding = amount)", async () => {
    const sql = makeSql({ record_advance: [{ id: AID }], get_advance: [advRow({ status: "active", source: "direct", recoveryPlan: "full_next", outstanding: "10000" })] });
    const adv = await recordAdvance(sql, "off", { ...base, recoveryPlan: "full_next" });
    expect(adv).toMatchObject({ status: "active", source: "direct", outstanding: 10000 });
  });
  it("records an installment advance", async () => {
    const sql = makeSql({ record_advance: [{ id: AID }], get_advance: [advRow({ status: "active", recoveryPlan: "installment", installmentAmount: "2000" })] });
    const adv = await recordAdvance(sql, "off", { ...base, recoveryPlan: "installment", installmentAmount: 2000 });
    expect(adv.installmentAmount).toBe(2000);
  });
});

describe("approveAdvance", () => {
  it("409 when not requested", async () => {
    await expect(approveAdvance(makeSql({ get_advance: [advRow({ status: "active" })] }), "off", AID, { recoveryPlan: "full_next" }))
      .rejects.toMatchObject({ status: 409 });
  });
  it("422 on a bad plan", async () => {
    await expect(approveAdvance(makeSql({ get_advance: [advRow()] }), "off", AID, { recoveryPlan: "nope" }))
      .rejects.toMatchObject({ status: 422 });
  });
  it("activates the advance with an installment or full-next plan", async () => {
    const sql = makeSql({ get_advance: [advRow()] });
    await approveAdvance(sql, "off", AID, { recoveryPlan: "installment", installmentAmount: 2000 });
    expect(calledTag(sql, "approve_advance")).toBe(true);
    const sql2 = makeSql({ get_advance: [advRow()] });
    await approveAdvance(sql2, "off", AID, { recoveryPlan: "full_next" }); // installmentAmount undefined → ?? null
    expect(sql2.calls.find((c) => c.tag === "approve_advance")!.params).toContain(null);
  });
});

describe("rejectAdvance", () => {
  it("422 on a blank reason", async () => {
    await expect(rejectAdvance(makeSql(), "off", AID, "  ")).rejects.toMatchObject({ status: 422 });
  });
  it("409 when not requested", async () => {
    await expect(rejectAdvance(makeSql({ get_advance: [advRow({ status: "active" })] }), "off", AID, "no budget"))
      .rejects.toMatchObject({ status: 409 });
  });
  it("rejects a requested advance", async () => {
    const sql = makeSql({ get_advance: [advRow()] });
    await rejectAdvance(sql, "off", AID, "  no budget  ");
    expect(sql.calls.find((c) => c.tag === "reject_advance")!.params).toContain("no budget");
  });
});

describe("getAdvance", () => {
  it("404 when missing", async () => {
    await expect(getAdvance(makeSql({ get_advance: [] }), AID)).rejects.toMatchObject({ status: 404 });
  });
  it("maps a Date createdAt, an installment number, and a numeric amount", async () => {
    const sql = makeSql({ get_advance: [advRow({ amount: 10000, installmentAmount: "2000", createdAt: new Date("2026-11-28T04:00:00.000Z") })] });
    const adv = await getAdvance(sql, AID);
    expect(adv.amount).toBe(10000); // numeric (not string) → num number-branch
    expect(adv.installmentAmount).toBe(2000);
    expect(adv.createdAt).toBe("2026-11-28T04:00:00.000Z");
  });
});

describe("queries", () => {
  it("listAdvances defaults to requested and honours a status", async () => {
    const sql = makeSql({ list_advances: [advRow()] });
    await listAdvances(sql, "");
    expect(sql.calls.find((c) => c.tag === "list_advances")!.params).toEqual(["requested"]);
    await listAdvances(sql, "active");
    expect(sql.calls.filter((c) => c.tag === "list_advances").at(-1)!.params).toEqual(["active"]);
  });
  it("perPersonAdvanceBalances maps outstanding per person", async () => {
    const sql = makeSql({ advance_balances: [{ userId: SE, userName: "Priya", outstanding: "8000" }] });
    expect(await perPersonAdvanceBalances(sql)).toEqual([{ userId: SE, userName: "Priya", outstanding: 8000 }]);
  });
  it("myAdvances totals only active outstanding", async () => {
    const sql = makeSql({ my_advances: [advRow({ status: "active", outstanding: "8000" }), advRow({ id: "a2", status: "cleared", outstanding: "0" })] });
    const out = await myAdvances(sql, SE);
    expect(out.outstandingTotal).toBe(8000);
    expect(out.advances).toHaveLength(2);
  });
});
