import { describe, expect, it } from "vitest";
import { employeeLedger } from "./employee-ledger";
import { makeSql } from "../test/sql-mock";

const USER = "00000000-0000-4000-8000-000000000004";

const base = (over: Record<string, unknown> = {}) => ({
  ledger_payables: [
    { amount: "400", status: "owed", created_at: "2026-11-01T00:00:00Z", paid_at: null, reversed_at: null, payment_mode: null, category: "Fuel" },
    { amount: "300", status: "paid", created_at: "2026-11-02T00:00:00Z", paid_at: "2026-11-05T00:00:00Z", reversed_at: null, payment_mode: "cash", category: "Food" },
    { amount: "100", status: "reversed", created_at: "2026-11-02T06:00:00Z", paid_at: null, reversed_at: "2026-11-04T00:00:00Z", payment_mode: null, category: "Toll" },
  ],
  ledger_advances: [{ amount: "5000", status: "active", at: "2026-11-03T00:00:00Z" }],
  ledger_recoveries: [{ amount: "5000", at: "2026-11-06T00:00:00Z" }],
  ledger_salary: [{ net_paid: "20000", paid_at: "2026-11-06T09:00:00Z" }],
  ledger_owed: [{ v: "400" }],
  ledger_outstanding: [{ v: "0" }],
  ledger_current_salary: [{ monthly_amount: "25000" }],
  ledger_this_month: [{ net_paid: "20000" }],
  ...over,
});

describe("employeeLedger", () => {
  it("merges claims/advances/recoveries into a time-ordered running balance", async () => {
    const l = await employeeLedger(makeSql(base()), USER, true);
    // +400, +300, −5000, −300(reversed earlier at 11-04), −300(reimbursed 11-05), +5000
    const claim = l.entries.find((e) => e.kind === "claim_approved");
    expect(claim).toMatchObject({ amount: 400, owedDelta: 400, balance: 400 });
    expect(l.entries.find((e) => e.kind === "advance")).toMatchObject({ owedDelta: -5000 });
    expect(l.entries.find((e) => e.kind === "reimbursed")).toMatchObject({ owedDelta: -300, label: "Reimbursed · cash" });
    expect(l.entries.find((e) => e.kind === "claim_reversed")).toMatchObject({ owedDelta: -100 });
    expect(l.entries.find((e) => e.kind === "recovered")).toMatchObject({ owedDelta: 5000 });
    expect(l.entries.find((e) => e.kind === "salary")).toMatchObject({ amount: 20000, owedDelta: 0 });
    expect(l.entries.at(-1)!.balance).toBe(400); // net settles back to the owed 400
    expect(l.summary).toEqual({ reimbursementOwed: 400, advanceOutstanding: 0, monthlySalary: 25000, thisMonthNet: 20000 });
    expect(l.salaryIncluded).toBe(true);
  });

  it("omits salary rows + figures when the caller can't view salary", async () => {
    const l = await employeeLedger(makeSql(base()), USER, false);
    expect(l.entries.some((e) => e.kind === "salary")).toBe(false);
    expect(l.salaryIncluded).toBe(false);
    expect(l.summary.monthlySalary).toBeNull();
    expect(l.summary.thisMonthNet).toBeNull();
  });

  it("handles an empty ledger and a person with no salary set", async () => {
    const sql = makeSql({ ledger_payables: [], ledger_advances: [], ledger_recoveries: [], ledger_salary: [], ledger_owed: [{ v: "0" }], ledger_outstanding: [{ v: "0" }], ledger_current_salary: [], ledger_this_month: [] });
    const l = await employeeLedger(sql, USER, true);
    expect(l.entries).toHaveLength(0);
    expect(l.summary).toEqual({ reimbursementOwed: 0, advanceOutstanding: 0, monthlySalary: null, thisMonthNet: null });
  });
});
