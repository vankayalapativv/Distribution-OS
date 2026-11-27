import { afterEach, describe, expect, it, vi } from "vitest";
import { calledTag, makeSql } from "../test/sql-mock";
import { currentSalary, listSalaries, listStaff, mySalary, paySalary, setSalary, voidSalaryPayment } from "./salary";

afterEach(() => vi.clearAllMocks());

const USER = "00000000-0000-4000-8000-000000000004";
const payBase = (over: Record<string, unknown> = {}) => ({
  current_salary: [{ monthly_amount: "20000" }],
  salary_payment_dupe: [],
  salary_category: [{ id: "cat-sal" }],
  active_advances_for_recovery: [],
  next_salary_exp_code: [{ seq: 5 }],
  ...over,
});
const recovery = (sql: ReturnType<typeof makeSql>) => {
  // insert params: [paymentId, userId, periodMonth, gross, recovered, net, …]
  const p = sql.calls.find((c) => c.tag === "record_salary_payment")!.params;
  return { gross: p[3], recovered: p[4], net: p[5] };
};
const advUpdates = (sql: ReturnType<typeof makeSql>) => sql.calls.filter((c) => c.tag === "recover_advance").map((c) => c.params);
const recoveryRows = (sql: ReturnType<typeof makeSql>) => sql.calls.filter((c) => c.tag === "record_recovery").map((c) => ({ advanceId: c.params[1], amount: c.params[2] }));

describe("currentSalary + setSalary", () => {
  it("returns null when no salary is set, else the latest", async () => {
    expect(await currentSalary(makeSql({ current_salary: [] }), USER)).toBeNull();
    expect(await currentSalary(makeSql({ current_salary: [{ monthly_amount: "20000" }] }), USER)).toBe(20000);
  });
  it("422 on a non-positive salary, else upserts", async () => {
    await expect(setSalary(makeSql(), "off", USER, 0, null)).rejects.toMatchObject({ status: 422 });
    const sql = makeSql();
    expect(await setSalary(sql, "off", USER, 20000, "2026-11-01")).toEqual({ userId: USER, monthlyAmount: 20000 });
    expect(calledTag(sql, "set_salary")).toBe(true);
  });
});

describe("listStaff + listSalaries", () => {
  it("lists active staff", async () => {
    const sql = makeSql({ list_staff: [{ id: USER, name: "Priya", role: "SALES_EXECUTIVE" }] });
    expect(await listStaff(sql)).toEqual([{ id: USER, name: "Priya", role: "SALES_EXECUTIVE" }]);
  });
  it("coerces a Date value through str", async () => {
    const sql = makeSql({ list_staff: [{ id: new Date("2026-11-28T00:00:00.000Z"), name: "X", role: null }] });
    expect((await listStaff(sql))[0].id).toBe("2026-11-28T00:00:00.000Z");
  });
  it("maps the salary table (null salary + paid flag)", async () => {
    const sql = makeSql({ list_salaries: [
      { userId: USER, userName: "Priya", salary: "20000", advanceOutstanding: "8000", paidThisMonth: true, paymentId: "pay-1" },
      { userId: "u2", userName: null, salary: null, advanceOutstanding: "0", paidThisMonth: false, paymentId: null },
    ] });
    const out = await listSalaries(sql);
    expect(out[0]).toMatchObject({ salary: 20000, advanceOutstanding: 8000, paidThisMonth: true, paymentId: "pay-1" });
    expect(out[1]).toMatchObject({ userName: null, salary: null, paidThisMonth: false, paymentId: null });
  });
});

describe("paySalary", () => {
  it("422 when no salary is set", async () => {
    await expect(paySalary(makeSql(payBase({ current_salary: [] })), "off", USER, "2026-11-01", null)).rejects.toMatchObject({ status: 422 });
  });
  it("409 when already paid this month", async () => {
    await expect(paySalary(makeSql(payBase({ salary_payment_dupe: [{ x: 1 }] })), "off", USER, "2026-11-01", null)).rejects.toMatchObject({ status: 409 });
  });
  it("404 when the Salaries category is missing", async () => {
    await expect(paySalary(makeSql(payBase({ salary_category: [] })), "off", USER, "2026-11-01", null)).rejects.toMatchObject({ status: 404 });
  });

  it("pays full salary with no advances", async () => {
    const sql = makeSql(payBase());
    const r = await paySalary(sql, "off", USER, "2026-11-01", "bank_transfer");
    expect(r).toMatchObject({ gross: 20000, advanceRecovered: 0, net: 20000 });
    expect(recovery(sql)).toEqual({ gross: 20000, recovered: 0, net: 20000 });
    expect(calledTag(sql, "book_salary_expenditure")).toBe(true);
    expect(advUpdates(sql)).toHaveLength(0);
  });

  it("recovers a full-next advance in full (advance cleared)", async () => {
    const sql = makeSql(payBase({ active_advances_for_recovery: [{ id: "a1", outstanding: "10000", recovery_plan: "full_next", installment_amount: null }] }));
    const r = await paySalary(sql, "off", USER, "2026-11-01", null);
    expect(r).toMatchObject({ advanceRecovered: 10000, net: 10000 });
    expect(advUpdates(sql)[0]).toEqual([0, "cleared", "a1"]);
  });

  it("caps recovery at the salary and carries the rest (over-advance)", async () => {
    const sql = makeSql(payBase({ active_advances_for_recovery: [{ id: "a1", outstanding: "25000", recovery_plan: "full_next", installment_amount: null }] }));
    const r = await paySalary(sql, "off", USER, "2026-11-01", null);
    expect(r).toMatchObject({ advanceRecovered: 20000, net: 0 });
    expect(advUpdates(sql)[0]).toEqual([5000, "active", "a1"]); // 25000 − 20000 carried
  });

  it("recovers only the monthly installment", async () => {
    const sql = makeSql(payBase({ active_advances_for_recovery: [{ id: "a1", outstanding: "10000", recovery_plan: "installment", installment_amount: "2000" }] }));
    const r = await paySalary(sql, "off", USER, "2026-11-01", null);
    expect(r).toMatchObject({ advanceRecovered: 2000, net: 18000 });
    expect(advUpdates(sql)[0]).toEqual([8000, "active", "a1"]);
  });

  it("treats an installment with no amount as the full balance", async () => {
    const sql = makeSql(payBase({ active_advances_for_recovery: [{ id: "a1", outstanding: "5000", recovery_plan: "installment", installment_amount: null }] }));
    const r = await paySalary(sql, "off", USER, "2026-11-01", null);
    expect(r).toMatchObject({ advanceRecovered: 5000 });
  });

  it("recovers across multiple advances oldest-first, capped at salary", async () => {
    const sql = makeSql(payBase({ active_advances_for_recovery: [
      { id: "a1", outstanding: "15000", recovery_plan: "full_next", installment_amount: null },
      { id: "a2", outstanding: "10000", recovery_plan: "full_next", installment_amount: null },
    ] }));
    const r = await paySalary(sql, "off", USER, "2026-11-01", null);
    expect(r).toMatchObject({ advanceRecovered: 20000, net: 0 });
    expect(advUpdates(sql)).toEqual([[0, "cleared", "a1"], [5000, "active", "a2"]]);
  });

  it("stops once the salary is exhausted (later advances carry untouched)", async () => {
    const sql = makeSql(payBase({ active_advances_for_recovery: [
      { id: "a1", outstanding: "15000", recovery_plan: "full_next", installment_amount: null },
      { id: "a2", outstanding: "10000", recovery_plan: "full_next", installment_amount: null },
      { id: "a3", outstanding: "5000", recovery_plan: "full_next", installment_amount: null },
    ] }));
    const r = await paySalary(sql, "off", USER, "2026-11-01", null);
    expect(r).toMatchObject({ advanceRecovered: 20000, net: 0 });
    expect(advUpdates(sql)).toEqual([[0, "cleared", "a1"], [5000, "active", "a2"]]); // a3 skipped (break)
  });

  it("defaults the expenditure code to 1 on an empty table", async () => {
    const sql = makeSql(payBase({ next_salary_exp_code: [{ seq: 0 }] }));
    await paySalary(sql, "off", USER, "2026-11-01", null);
    expect(sql.calls.find((c) => c.tag === "book_salary_expenditure")!.params).toContain("EXP-0001");
  });

  it("records one recovery row per recovered advance (the reversal breadcrumb)", async () => {
    const sql = makeSql(payBase({ active_advances_for_recovery: [
      { id: "a1", outstanding: "15000", recovery_plan: "full_next", installment_amount: null },
      { id: "a2", outstanding: "10000", recovery_plan: "full_next", installment_amount: null },
    ] }));
    await paySalary(sql, "off", USER, "2026-11-01", null);
    expect(recoveryRows(sql)).toEqual([{ advanceId: "a1", amount: 15000 }, { advanceId: "a2", amount: 5000 }]);
  });
});

describe("voidSalaryPayment", () => {
  const voidBase = (over: Record<string, unknown> = {}) => ({
    get_salary_payment: [{ id: "p1", userId: USER, userName: "Priya", gross: "20000", recovered: "10000", net: "10000", expenditureId: "exp-1", reversedAt: null }],
    salary_recoveries: [{ advanceId: "a1", amount: "10000" }],
    ...over,
  });

  it("404 when the payment is missing", async () => {
    await expect(voidSalaryPayment(makeSql({ get_salary_payment: [] }), "off", "p1", null)).rejects.toMatchObject({ status: 404 });
  });
  it("409 when already reversed", async () => {
    const sql = makeSql(voidBase({ get_salary_payment: [{ id: "p1", userId: USER, gross: "20000", recovered: "0", expenditureId: "exp-1", reversedAt: new Date() }] }));
    await expect(voidSalaryPayment(sql, "off", "p1", null)).rejects.toMatchObject({ status: 409 });
  });
  it("reverses the payment + expenditure and restores each recovered advance", async () => {
    const sql = makeSql(voidBase({ salary_recoveries: [{ advanceId: "a1", amount: "6000" }, { advanceId: "a2", amount: "4000" }] }));
    const r = await voidSalaryPayment(sql, "off", "p1", "wrong month");
    expect(r).toMatchObject({ id: "p1", userId: USER, userName: "Priya", gross: 20000, advanceRestored: 10000, reason: "wrong month" });
    expect(calledTag(sql, "reverse_salary_payment")).toBe(true);
    expect(calledTag(sql, "reverse_salary_expenditure")).toBe(true);
    const restores = sql.calls.filter((c) => c.tag === "restore_advance").map((c) => c.params);
    expect(restores).toEqual([[6000, "a1"], [4000, "a2"]]);
  });
  it("skips the expenditure reversal when the run booked none", async () => {
    const sql = makeSql(voidBase({ get_salary_payment: [{ id: "p1", userId: USER, gross: "20000", recovered: "0", expenditureId: null, reversedAt: null }], salary_recoveries: [] }));
    await voidSalaryPayment(sql, "off", "p1", null);
    expect(calledTag(sql, "reverse_salary_payment")).toBe(true);
    expect(calledTag(sql, "reverse_salary_expenditure")).toBe(false);
  });
});

describe("mySalary", () => {
  it("returns salary, outstanding, and this-month pay when present", async () => {
    const sql = makeSql({
      current_salary: [{ monthly_amount: "20000" }],
      my_advance_outstanding: [{ outstanding: "8000" }],
      my_salary_this_month: [{ gross: "20000", recovered: "10000", net: "10000" }],
    });
    expect(await mySalary(sql, USER)).toEqual({
      monthlySalary: 20000, advanceOutstanding: 8000,
      thisMonth: { paid: true, gross: 20000, recovered: 10000, net: 10000 },
    });
  });
  it("returns nulls when nothing is set or paid", async () => {
    const sql = makeSql({ current_salary: [], my_advance_outstanding: [{ outstanding: "0" }], my_salary_this_month: [] });
    expect(await mySalary(sql, USER)).toEqual({ monthlySalary: null, advanceOutstanding: 0, thisMonth: null });
  });
});
