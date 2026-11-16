import { describe, expect, it } from "vitest";
import { getGstr1Dataset } from "./invoice-gst-export";
import { makeSql } from "../test/sql-mock";

describe("getGstr1Dataset", () => {
  it("rejects a non yyyy-mm-dd from/to with a 422", async () => {
    await expect(getGstr1Dataset(makeSql(), "2026/01/01", "2026-01-31")).rejects.toMatchObject({
      code: "INVALID_FIELD",
      status: 422,
    });
    await expect(getGstr1Dataset(makeSql(), "2026-01-01", "bad")).rejects.toMatchObject({ status: 422 });
  });

  it("builds every GSTR-1 section and the seller header from generated invoices", async () => {
    const sql = makeSql({
      gst_seller: [{ gstin: "36AYJPC8376L1ZU", legalName: "VKR Sales", stateCode: "36" }],
      gst_b2b: [
        {
          invoiceNumber: "GSTAL/895",
          invoiceDate: new Date("2026-10-01T00:00:00Z"),
          gstin: "36AYJPC8376L1ZU",
          receiver: "SEETHA MOTORS",
          invoiceValue: "19200",
          placeOfSupply: "36",
          reverseCharge: false,
          rate: "18",
          taxable: "16271.18",
          cgst: "1464.41",
          sgst: "1464.41",
          igst: "0",
        },
      ],
      gst_b2cl: [
        {
          invoiceNumber: "GSTAL/900",
          invoiceDate: new Date("2026-10-03T00:00:00Z"),
          invoiceValue: "300000",
          placeOfSupply: "29",
          rate: "18",
          taxable: "254237.29",
          igst: "45762.71",
        },
      ],
      gst_b2cs: [{ placeOfSupply: "36", supplyType: "intra", rate: "18", taxable: "1112544.86", cgst: "100129.04", sgst: "100129.04", igst: "0" }],
      gst_cdnr: [
        {
          noteNumber: "CN/202610/0001",
          noteDate: new Date("2026-10-10T00:00:00Z"),
          gstin: "36AYJPC8376L1ZU",
          receiver: "SEETHA MOTORS",
          noteValue: "1180",
          placeOfSupply: "36",
          rate: "18",
          taxable: "1000",
          cgst: "90",
          sgst: "90",
          igst: "0",
        },
      ],
      gst_cdnur: [
        {
          noteNumber: "CN/202610/0002",
          noteDate: new Date("2026-10-11T00:00:00Z"),
          receiver: "WALK-IN",
          noteValue: "590",
          placeOfSupply: "29",
          rate: "18",
          taxable: "500",
          cgst: "0",
          sgst: "0",
          igst: "90",
        },
      ],
      gst_exemp: [{ regType: "unreg", supplyType: "intra", exempted: "2500" }],
      gst_hsn_b2b: [{ hsnCode: "27101980", rate: "18", qty: "100", taxable: "16271.18", cgst: "1464.41", sgst: "1464.41", igst: "0" }],
      gst_hsn_b2c: [{ hsnCode: "27101980", rate: "18", qty: "900", taxable: "1112544.86", cgst: "100129.04", sgst: "100129.04", igst: "0" }],
      gst_docs_inv: [{ issued: "187", cancelled: "0", firstNo: "GSTAL/893", lastNo: "GSTAL/1079" }],
      gst_docs_cn: [{ issued: "2", firstNo: "CN/202610/0001", lastNo: "CN/202610/0002" }],
      gst_totals: [{ invoices: "189", taxable: "1741834.84", tax: "313530.16" }],
    });

    const out = await getGstr1Dataset(sql, "2026-10-01", "2026-10-31");

    expect(out.period).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(out.seller).toEqual({ gstin: "36AYJPC8376L1ZU", legalName: "VKR Sales", stateCode: "36" });

    expect(out.b2b[0]).toMatchObject({
      invoiceNumber: "GSTAL/895", invoiceDate: "2026-10-01", gstin: "36AYJPC8376L1ZU",
      receiver: "SEETHA MOTORS", invoiceValue: 19200, placeOfSupply: "36",
      reverseCharge: false, rate: 18, taxable: 16271.18, cgst: 1464.41, sgst: 1464.41, igst: 0,
    });

    expect(out.b2cl[0]).toMatchObject({ invoiceNumber: "GSTAL/900", invoiceValue: 300000, placeOfSupply: "29", igst: 45762.71 });
    expect(out.b2cs[0]).toMatchObject({ placeOfSupply: "36", supplyType: "intra", rate: 18, taxable: 1112544.86 });

    expect(out.cdnr[0]).toMatchObject({ noteNumber: "CN/202610/0001", gstin: "36AYJPC8376L1ZU", noteValue: 1180, cgst: 90, sgst: 90 });
    expect(out.cdnur[0]).toMatchObject({ noteNumber: "CN/202610/0002", urType: "B2CL", noteValue: 590, igst: 90 });

    expect(out.exemp[0]).toEqual({ regType: "unreg", supplyType: "intra", exempted: 2500 });

    expect(out.hsnB2b[0]).toMatchObject({ hsnCode: "27101980", uqc: "BOX-BOX", rate: 18, qty: 100 });
    expect(out.hsnB2c[0]).toMatchObject({ hsnCode: "27101980", uqc: "BOX-BOX", rate: 18, qty: 900 });

    expect(out.docs).toEqual([
      { docType: "Invoices for outward supply", firstNo: "GSTAL/893", lastNo: "GSTAL/1079", issued: 187, cancelled: 0 },
      { docType: "Credit Note", firstNo: "CN/202610/0001", lastNo: "CN/202610/0002", issued: 2, cancelled: 0 },
    ]);

    expect(out.totals).toEqual({ invoices: 189, taxable: 1741834.84, tax: 313530.16 });
  });

  it("coerces empty sections, a missing seller, and a zero credit-note range", async () => {
    const sql = makeSql({
      gst_docs_inv: [{ issued: 0, cancelled: 0, firstNo: null, lastNo: null }],
      gst_docs_cn: [{ issued: 0, firstNo: null, lastNo: null }],
      gst_totals: [{ invoices: 0, taxable: 0, tax: 0 }],
    });

    const out = await getGstr1Dataset(sql, "2026-02-01", "2026-02-28");

    expect(out.seller).toEqual({ gstin: "", legalName: "", stateCode: "" });
    expect(out.b2b).toEqual([]);
    expect(out.b2cl).toEqual([]);
    expect(out.cdnr).toEqual([]);
    expect(out.exemp).toEqual([]);
    expect(out.docs[0]).toMatchObject({ firstNo: null, lastNo: null, issued: 0 });
    // A period with no credit notes leaves the CN range null rather than a bogus span.
    expect(out.docs[1]).toEqual({ docType: "Credit Note", firstNo: null, lastNo: null, issued: 0, cancelled: 0 });
    expect(out.totals).toEqual({ invoices: 0, taxable: 0, tax: 0 });
  });
});
