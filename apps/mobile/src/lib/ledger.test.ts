import { describe, expect, it } from "vitest";
import { sliceLedger, type LedgerData } from "./ledger";

// A full (all-time) ledger: three sales and one receipt, cumulative balance.
const full: LedgerData = {
  from: "2000-01-01",
  to: "2026-08-09",
  openingBalance: 0,
  rows: [
    { date: "2026-05-10", type: "Sale", vchNo: "A1", particulars: "Cr", narration: "Sales", debit: 1000, credit: null, balance: 1000 },
    { date: "2026-06-15", type: "Rcpt", vchNo: null, particulars: "Dr", narration: "Cash", debit: null, credit: 400, balance: 600 },
    { date: "2026-07-20", type: "Sale", vchNo: "A2", particulars: "Cr", narration: "Sales", debit: 500, credit: null, balance: 1100 },
    { date: "2026-08-05", type: "Sale", vchNo: "A3", particulars: "Cr", narration: "Sales", debit: 300, credit: null, balance: 1400 },
  ],
  totals: { debit: 1800, credit: 400, closingBalance: 1400 },
};

describe("sliceLedger", () => {
  it("keeps only rows within [from,to] and carries the opening balance in", () => {
    const s = sliceLedger(full, "2026-07-01", "2026-08-31");
    expect(s.rows.map((r) => r.vchNo)).toEqual(["A2", "A3"]);
    // Opening = balance entering the window = the 15 Jun receipt row's balance (600).
    expect(s.openingBalance).toBe(600);
    expect(s.totals.debit).toBe(800);
    expect(s.totals.credit).toBe(0);
    expect(s.totals.closingBalance).toBe(1400);
    expect(s.from).toBe("2026-07-01");
    expect(s.to).toBe("2026-08-31");
  });

  it("uses the full opening balance when nothing precedes the window", () => {
    const s = sliceLedger(full, "2026-01-01", "2026-05-31");
    expect(s.rows.map((r) => r.vchNo)).toEqual(["A1"]);
    expect(s.openingBalance).toBe(0);
    expect(s.totals.closingBalance).toBe(1000);
  });

  it("returns an empty slice (opening = closing) for a gap window", () => {
    const s = sliceLedger(full, "2026-06-16", "2026-07-19");
    expect(s.rows).toHaveLength(0);
    expect(s.openingBalance).toBe(600);
    expect(s.totals).toEqual({ debit: 0, credit: 0, closingBalance: 600 });
  });

  it("includes rows dated exactly on the range bounds", () => {
    const s = sliceLedger(full, "2026-07-20", "2026-08-05");
    expect(s.rows.map((r) => r.vchNo)).toEqual(["A2", "A3"]);
  });
});
