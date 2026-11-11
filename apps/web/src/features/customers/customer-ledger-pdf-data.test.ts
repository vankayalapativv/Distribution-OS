import { describe, expect, it } from "vitest";
import { amt, bal, buildLedgerOptions, fmtDate, todayIst } from "./customer-ledger-pdf-data";
import type { LedgerData, LedgerRow } from "./customer-ledger-tab";

const row = (o: Partial<LedgerRow>): LedgerRow => ({
  date: "2026-09-15", type: "Sale", vchNo: "INV-1", particulars: "Goods", narration: "",
  debit: 100, credit: null, balance: 100, ...o,
} as LedgerRow);

const data = (o: Partial<LedgerData> = {}): LedgerData => ({
  from: "2026-09-01", to: "2026-09-30", openingBalance: 500,
  rows: [row({})],
  totals: { debit: 100, credit: 40, closingBalance: 560 },
  ...o,
});

describe("formatters", () => {
  it("amt: 2-dp Indian grouping", () => expect(amt(1234567.5)).toBe("12,34,567.50"));
  it("bal: Dr / Cr / zero", () => {
    expect(bal(100)).toBe("100.00 Dr");
    expect(bal(-100)).toBe("100.00 Cr");
    expect(bal(0.004)).toBe("0.00"); // within the epsilon
  });
  it("fmtDate: ISO → DD-MM-YYYY", () => expect(fmtDate("2026-09-15")).toBe("15-09-2026"));
  it("todayIst: DD/MM/YYYY", () => expect(todayIst()).toMatch(/^\d{2}\/\d{2}\/\d{4}$/));
});

describe("buildLedgerOptions", () => {
  it("builds the opening row + a row per transaction, sanitising the file name", () => {
    const o = buildLedgerOptions('A/B:C"?', data({ rows: [row({ debit: 100, credit: null, vchNo: null }), row({ debit: null, credit: 40 })] }));
    expect(o.fileName).toBe("Ledger - A-B-C--.pdf");
    expect(o.body).toHaveLength(3); // opening + 2 rows
    expect(o.title).toBe("Ledger");
  });

  it("renders an empty-period placeholder when there are no rows", () => {
    const o = buildLedgerOptions("Shop", data({ rows: [] }));
    expect(o.body).toHaveLength(2); // opening + placeholder
    expect(JSON.stringify(o.body[1])).toContain("No transactions in this period.");
  });

  it("labels the closing balance Debit vs Credit and totals the grand columns", () => {
    expect(JSON.stringify(buildLedgerOptions("S", data({ totals: { debit: 100, credit: 40, closingBalance: 560 } })).foot)).toContain("Debit Balance");
    expect(JSON.stringify(buildLedgerOptions("S", data({ totals: { debit: 100, credit: 40, closingBalance: -60 } })).foot)).toContain("Credit Balance");
  });

  it("handles a credit (negative) opening balance in the grand totals", () => {
    const o = buildLedgerOptions("S", data({ openingBalance: -300, totals: { debit: 100, credit: 40, closingBalance: -60 } }));
    // grandCredit includes max(0, -opening)=300; grandDebit's max(0, opening)=0.
    expect(JSON.stringify(o.body[0])).toContain("300.00 Cr");
  });

  it("didParseCell rules only the middle foot balance row", () => {
    const o = buildLedgerOptions("S", data());
    const ruled = { section: "foot", row: { index: 1 }, cell: { styles: {} as Record<string, unknown> } };
    const other = { section: "foot", row: { index: 0 }, cell: { styles: {} as Record<string, unknown> } };
    // @ts-expect-error — minimal hook-data shape for the branch under test.
    o.didParseCell?.(ruled);
    // @ts-expect-error — minimal hook-data shape.
    o.didParseCell?.(other);
    expect(ruled.cell.styles.lineWidth).toEqual({ top: 0 });
    expect(other.cell.styles.lineWidth).toBeUndefined();
  });
});
