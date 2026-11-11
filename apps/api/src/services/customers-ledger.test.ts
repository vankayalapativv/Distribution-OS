import { describe, expect, it } from "vitest";
import { getCustomerLedger, getCustomerLedgersBulk } from "./customers-ledger";
import { makeSql } from "../test/sql-mock";

const CUST = "cust-1";

const RANGE = [{ from: "2026-06-01", to: "2026-06-30", today: "2026-06-30" }];

describe("getCustomerLedger", () => {
  it("assembles a running Dr/Cr statement with payoff status, labels and totals", async () => {
    const sql = makeSql({
      ledger_range: RANGE,
      ledger_opening: [{ opening: "1000" }],
      ledger_invoices: [
        // paid off (outstanding 0, has a settled date)
        { id: "i1", vchNo: "INV-1", date: "2026-06-02", amount: "500", outstanding: "0", amountCollected: "500", settledDate: "2026-06-10" },
        // partially paid (some collected, still owing)
        { id: "i2", vchNo: "INV-2", date: "2026-06-03", amount: "800", outstanding: "300", amountCollected: "500", settledDate: null },
        // untouched (nothing collected yet)
        { id: "i3", vchNo: "INV-3", date: "2026-06-04", amount: "200", outstanding: "200", amountCollected: "0", settledDate: null },
      ],
      ledger_collections: [
        // same date as i1 (2026-06-02) → exercises the sort tie-break on sortKey
        { id: "c1", date: "2026-06-02", paymentMode: "upi", amount: "500", status: "verified", hasProof: true },
        { id: "c2", date: "2026-06-06", paymentMode: "", amount: "100", status: "pending", hasProof: false },
        { id: "c3", date: "2026-06-07", paymentMode: "wallet_x", amount: "50", status: "verified", hasProof: false },
        // null date → toDateStr() "" fallback; zero amount keeps totals intact
        { id: "c4", date: null, paymentMode: "cash", amount: "0", status: "verified", hasProof: false },
      ],
      ledger_returns: [{ id: "r1", date: "2026-06-08", amount: "75", vchNo: "INV-1", invoiceId: "i1", hasProof: true }],
      // stored opening balance INSIDE the window → a visible "Opening Balance" row
      ledger_customer_opening: [
        { asOfDate: "2026-06-01", amount: "400", amountCollected: "400", outstanding: "0", settledDate: "2026-06-09" },
      ],
    });
    const data = await getCustomerLedger(sql, CUST, "2026-06-01", "2026-06-30");

    expect(data.from).toBe("2026-06-01");
    const sale1 = data.rows.find((r) => r.invoiceId === "i1" && r.type === "Sale")!;
    expect(sale1).toMatchObject({ paidOff: true });
    expect(sale1.payoffDays).toBe(8); // 06-02 → 06-10

    const sale2 = data.rows.find((r) => r.invoiceId === "i2")!;
    expect(sale2).toMatchObject({ paidOff: false, partiallyPaid: true });

    const sale3 = data.rows.find((r) => r.invoiceId === "i3")!;
    expect(sale3).toMatchObject({ paidOff: false, partiallyPaid: false });

    const upi = data.rows.find((r) => r.collectionId === "c1")!;
    expect(upi.narration).toBe("UPI");
    const blank = data.rows.find((r) => r.collectionId === "c2")!;
    expect(blank).toMatchObject({ narration: "Payment", needsVerify: true });
    const wallet = data.rows.find((r) => r.collectionId === "c3")!;
    expect(wallet.narration).toBe("Wallet X"); // fallback title-casing

    // Opening Balance row visible (inside window) with its own payoff
    const ob = data.rows.find((r) => r.narration === "Opening Balance")!;
    expect(ob).toMatchObject({ debit: 400, paidOff: true });

    // Totals: debit = 500+800+200+400(opening row) = 1900; credit = 500+100+50+75 = 725
    expect(data.totals.debit).toBe(1900);
    expect(data.totals.credit).toBe(725);
    expect(data.totals.closingBalance).toBe(data.openingBalance + 1900 - 725);
  });

  it("folds a pre-window opening balance into the running start (no visible row)", async () => {
    const sql = makeSql({
      ledger_range: RANGE,
      ledger_opening: [{ opening: "0" }],
      ledger_invoices: [],
      ledger_collections: [],
      ledger_returns: [],
      ledger_customer_opening: [
        { asOfDate: "2026-01-01", amount: "1000", amountCollected: "0", outstanding: "1000", settledDate: null },
      ],
    });
    const data = await getCustomerLedger(sql, CUST, "2026-06-01", "2026-06-30");
    expect(data.openingBalance).toBe(1000); // carried into start
    expect(data.rows.find((r) => r.narration === "Opening Balance")).toBeUndefined();
  });

  it("works with no opening balance and default (null) range inputs", async () => {
    const sql = makeSql({
      ledger_range: RANGE,
      ledger_opening: [{ opening: "0" }],
      ledger_invoices: [],
      ledger_collections: [],
      ledger_returns: [],
      ledger_customer_opening: [],
    });
    const data = await getCustomerLedger(sql, CUST, null, null);
    expect(data.rows).toEqual([]);
    expect(data.totals).toEqual({ debit: 0, credit: 0, closingBalance: 0 });
  });
});

describe("getCustomerLedgersBulk", () => {
  const SA = { userId: "admin", role: "SUPER_ADMIN" as const };
  const SE = { userId: "se-1", role: "SALES_EXECUTIVE" as const };
  const now = [{ today: "2026-06-30", serverTime: new Date("2026-06-30T12:00:00Z") }];

  it("builds all-time ledgers per visible customer (cold pull)", async () => {
    const sql = makeSql({
      bulk_ledger_now: now,
      bulk_ledger_customers: [{ id: CUST }],
      bulk_ledger_invoices: [
        { customerId: CUST, id: "i1", vchNo: "INV-1", date: "2026-05-01", amount: "500", outstanding: "0", amountCollected: "500", settledDate: "2026-05-05" },
      ],
      bulk_ledger_collections: [
        { customerId: CUST, id: "c1", date: "2026-05-05", paymentMode: "cash", amount: "500", status: "verified", hasProof: false },
      ],
      bulk_ledger_returns: [],
      bulk_ledger_openings: [],
    });
    const out = await getCustomerLedgersBulk(sql, SA, null);
    expect(out.today).toBe("2026-06-30");
    expect(out.serverTime).toBe("2026-06-30T12:00:00.000Z");
    expect(out.ledgers).toHaveLength(1);
    expect(out.ledgers[0].customerId).toBe(CUST);
    expect(out.ledgers[0].ledger.rows.find((r) => r.narration === "Cash")).toBeDefined();
  });

  it("returns no ledgers when the caller sees no customers", async () => {
    const sql = makeSql({ bulk_ledger_now: now, bulk_ledger_customers: [] });
    expect(await getCustomerLedgersBulk(sql, SA, null)).toMatchObject({ ledgers: [] });
  });

  it("uses the changed-customers query on a delta pull", async () => {
    const sql = makeSql({
      bulk_ledger_now: now,
      bulk_ledger_changed_customers: [{ id: CUST }],
      bulk_ledger_invoices: [],
      bulk_ledger_collections: [],
      bulk_ledger_returns: [],
      bulk_ledger_openings: [
        { customerId: CUST, asOfDate: "2026-01-01", amount: "1000", amountCollected: "0", outstanding: "1000", settledDate: null },
      ],
    });
    const out = await getCustomerLedgersBulk(sql, SE, "2026-06-01T00:00:00Z");
    expect(sql.calls.some((c) => c.tag === "bulk_ledger_changed_customers")).toBe(true);
    // Full-history window (from 2000-01-01), so the 2026 opening shows as a row.
    const obRow = out.ledgers[0].ledger.rows.find((r) => r.narration === "Opening Balance")!;
    expect(obRow.debit).toBe(1000);
  });
});
