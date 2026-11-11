import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { EMPTY_COMPANY } from "@/lib/company";
import { downloadLedgerPdf } from "./customer-ledger-pdf";
import type { LedgerData } from "./customer-ledger-tab";

// jsPDF's .save() triggers a browser download — stub only that final primitive so
// the REAL jsPDF + autotable document is still built end to end.
const origCreate = globalThis.URL.createObjectURL;
const origRevoke = globalThis.URL.revokeObjectURL;
beforeAll(() => {
  globalThis.URL.createObjectURL = vi.fn(() => "blob:x");
  globalThis.URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterAll(() => {
  globalThis.URL.createObjectURL = origCreate;
  globalThis.URL.revokeObjectURL = origRevoke;
  vi.restoreAllMocks();
});

const data: LedgerData = {
  from: "2026-09-01",
  to: "2026-09-30",
  openingBalance: 500,
  rows: [
    { date: "2026-09-05", type: "Sale", vchNo: "INV-1", particulars: "Oils", narration: "", debit: 1200, credit: null, balance: 1700 } as LedgerData["rows"][number],
    { date: "2026-09-10", type: "Rcpt", vchNo: "RCPT-1", particulars: "Cash", narration: "", debit: null, credit: 700, balance: 1000 } as LedgerData["rows"][number],
  ],
  totals: { debit: 1200, credit: 700, closingBalance: 1000 },
};

describe("downloadLedgerPdf", () => {
  it("builds and saves a real ledger PDF end to end", async () => {
    await expect(downloadLedgerPdf("Ravi Motors", data, EMPTY_COMPANY)).resolves.toBeUndefined();
  });
});
