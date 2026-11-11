import { afterEach, describe, expect, it, vi } from "vitest";

const { getCustomerLedger } = vi.hoisted(() => ({ getCustomerLedger: vi.fn() }));
const { getSystemSettings } = vi.hoisted(() => ({ getSystemSettings: vi.fn() }));
vi.mock("./customers-ledger", () => ({ getCustomerLedger }));
vi.mock("./system-settings", () => ({ getSystemSettings }));

import { ensureStatementToken, getPublicStatementByToken } from "./customer-statement";
import { makeSql } from "../test/sql-mock";

const TOKEN = "11111111-2222-4333-8444-555555555555";
const LEDGER = { openingBalance: 0, rows: [], closingBalance: 100 };
const COMPANY = { name: "Sri Aparajita", gstin: "36XXX" };

afterEach(() => vi.clearAllMocks());

describe("ensureStatementToken", () => {
  it("returns the (mint-once) token", async () => {
    const sql = makeSql({ ensure_statement_token: [{ token: TOKEN }] });
    expect(await ensureStatementToken(sql, "cust-1")).toBe(TOKEN);
  });

  it("returns null when the customer id does not exist", async () => {
    const sql = makeSql({ ensure_statement_token: [] });
    expect(await ensureStatementToken(sql, "nope")).toBeNull();
  });
});

describe("getPublicStatementByToken", () => {
  it("returns null when the token matches no customer", async () => {
    const sql = makeSql({ statement_customer_by_token: [] });
    expect(await getPublicStatementByToken(sql, TOKEN)).toBeNull();
    expect(getCustomerLedger).not.toHaveBeenCalled();
  });

  it("builds the full statement (ageing, pending, ledger, company)", async () => {
    getCustomerLedger.mockResolvedValue(LEDGER);
    getSystemSettings.mockResolvedValue({ company: COMPANY });
    const sql = makeSql({
      statement_customer_by_token: [{ id: "cust-1", legalName: "Ravi Motors", tradeName: "Ravi", city: "Hyderabad" }],
      statement_from_date: [{ from: "2026-01-01" }],
      // Mixed string / null values exercise num()'s string + fallback branches.
      statement_ageing: [{ b0_30: "100", b30_45: 50, b45_60: null, b60_plus: 25, total: "175" }],
      statement_pending_verification: [{ pending: "75" }],
    });
    const stmt = await getPublicStatementByToken(sql, TOKEN);
    expect(stmt).not.toBeNull();
    expect(stmt!.customer).toEqual({ name: "Ravi", city: "Hyderabad" }); // trade name preferred
    expect(stmt!.totalOutstanding).toBe(175);
    expect(stmt!.paymentsUnderVerification).toBe(75);
    expect(stmt!.ageing).toEqual({ "0_30": 100, "30_45": 50, "45_60": 0, "60_plus": 25 });
    expect(stmt!.company).toEqual(COMPANY);
    expect(stmt!.ledger).toEqual(LEDGER);
    expect(getCustomerLedger).toHaveBeenCalledWith(sql, "cust-1", "2026-01-01", null);
  });

  it("falls back to the legal name and null city when trade name / city are blank", async () => {
    getCustomerLedger.mockResolvedValue(LEDGER);
    getSystemSettings.mockResolvedValue({ company: COMPANY });
    const sql = makeSql({
      // legalName null (→ str() "" fallback) with a blank trade name.
      statement_customer_by_token: [{ id: "cust-1", legalName: null, tradeName: "", city: null }],
      statement_from_date: [{ from: "2026-01-01" }],
      statement_ageing: [{ b0_30: 0, b30_45: 0, b45_60: 0, b60_plus: 0, total: 0 }],
      statement_pending_verification: [{ pending: 0 }],
    });
    const stmt = await getPublicStatementByToken(sql, TOKEN);
    expect(stmt!.customer).toEqual({ name: "", city: null });
  });
});
