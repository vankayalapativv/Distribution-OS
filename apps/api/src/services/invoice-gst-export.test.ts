import { describe, expect, it } from "vitest";
import { getInvoiceExport } from "./invoice-gst-export";
import { makeSql } from "../test/sql-mock";

describe("getInvoiceExport", () => {
  it("rejects a non yyyy-mm-dd from/to with a 422", async () => {
    await expect(getInvoiceExport(makeSql(), "2026/01/01", "2026-01-31")).rejects.toMatchObject({
      code: "INVALID_FIELD",
      status: 422,
    });
    await expect(getInvoiceExport(makeSql(), "2026-01-01", "bad")).rejects.toMatchObject({ status: 422 });
  });

  it("builds B2B / B2CS / HSN / docs / totals sheets from generated invoices", async () => {
    const sql = makeSql({
      gst_b2b: [
        {
          invoiceNumber: "INV-1",
          invoiceDate: new Date("2026-01-05T00:00:00Z"),
          gstin: "36ABCDE1234F1Z5",
          stateCode: "36",
          placeOfSupply: null,
          taxable: "1000",
          cgst: "90",
          sgst: "90",
          igst: "0",
          total: "1180",
        },
      ],
      gst_b2cs: [{ stateCode: "36", taxable: "500", cgst: "45", sgst: "45", igst: "0", invoices: "2" }],
      gst_hsn: [{ hsnCode: "2710", rate: "18", qty: "10", taxable: "1500", cgst: "135", sgst: "135", igst: "0" }],
      gst_docs: [{ issued: "3", cancelled: "1", firstNo: "INV-1", lastNo: "INV-3" }],
      gst_totals: [{ invoices: "3", taxable: "1500", tax: "270" }],
    });
    const out = await getInvoiceExport(sql, "2026-01-01", "2026-01-31");
    expect(out.period).toEqual({ from: "2026-01-01", to: "2026-01-31" });
    expect(out.b2b[0]).toMatchObject({ invoiceNumber: "INV-1", invoiceDate: "2026-01-05", taxable: 1000, placeOfSupply: null });
    expect(out.b2cs[0]).toMatchObject({ stateCode: "36", invoices: 2, taxable: 500 });
    expect(out.hsn[0]).toMatchObject({ hsnCode: "2710", rate: 18, qty: 10 });
    expect(out.docs).toEqual({ issued: 3, cancelled: 1, firstNo: "INV-1", lastNo: "INV-3" });
    expect(out.totals).toEqual({ invoices: 3, taxable: 1500, tax: 270 });
  });

  it("coerces empty sheets and null doc numbers", async () => {
    const sql = makeSql({
      gst_b2b: [],
      gst_b2cs: [],
      gst_hsn: [],
      gst_docs: [{ issued: 0, cancelled: 0, firstNo: null, lastNo: null }],
      gst_totals: [{ invoices: 0, taxable: 0, tax: 0 }],
    });
    const out = await getInvoiceExport(sql, "2026-02-01", "2026-02-28");
    expect(out.b2b).toEqual([]);
    expect(out.docs).toMatchObject({ firstNo: null, lastNo: null });
  });
});
