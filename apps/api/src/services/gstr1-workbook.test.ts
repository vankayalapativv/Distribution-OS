import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { autoColumnWidths, buildGstr1Workbook } from "./gstr1-workbook";
import type { Gstr1Dataset } from "./invoice-gst-export";

/** A compact dataset shaped like VKR's October filing (two B2B invoices with a
 *  second rate on one, one B2CS line, one credit note, exempt + HSN + docs). */
const DATA: Gstr1Dataset = {
  period: { from: "2026-10-01", to: "2026-10-31" },
  seller: { gstin: "36AYJPC8376L1ZU", legalName: "VKR Sales", stateCode: "36" },
  b2b: [
    { invoiceNumber: "GSTAL/895", invoiceDate: "2026-10-01", gstin: "36AYJPC8376L1ZU", receiver: "SEETHA MOTORS", invoiceValue: 19200, placeOfSupply: "36", reverseCharge: false, rate: 18, taxable: 16271.18, cgst: 1464.41, sgst: 1464.41, igst: 0 },
    { invoiceNumber: "GSTAL/896", invoiceDate: "2026-10-02", gstin: "27AAAAA0000A1Z5", receiver: "PUNE AUTO", invoiceValue: 23600, placeOfSupply: "27", reverseCharge: false, rate: 18, taxable: 20000, cgst: 0, sgst: 0, igst: 3600 },
    { invoiceNumber: "GSTAL/896", invoiceDate: "2026-10-02", gstin: "27AAAAA0000A1Z5", receiver: "PUNE AUTO", invoiceValue: 23600, placeOfSupply: "27", reverseCharge: false, rate: 5, taxable: 1000, cgst: 0, sgst: 0, igst: 50 },
  ],
  b2cl: [
    { invoiceNumber: "IGSAL/5", invoiceDate: "2026-10-05", invoiceValue: 300000, placeOfSupply: "29", rate: 18, taxable: 254237.29, igst: 45762.71 },
  ],
  b2cs: [
    { placeOfSupply: "36", supplyType: "intra", rate: 18, taxable: 1112544.86, cgst: 100129.04, sgst: 100129.04, igst: 0 },
  ],
  cdnr: [
    { noteNumber: "CN/202610/0001", noteDate: "2026-10-10", gstin: "36AYJPC8376L1ZU", receiver: "SEETHA MOTORS", noteValue: 1180, placeOfSupply: "36", rate: 18, taxable: 1000, cgst: 90, sgst: 90, igst: 0 },
  ],
  cdnur: [],
  exemp: [{ regType: "unreg", supplyType: "intra", exempted: 2500 }],
  hsnB2b: [{ hsnCode: "27101980", uqc: "BOX-BOX", rate: 18, qty: 17, taxable: 18658.47, cgst: 1404.61, sgst: 1404.61, igst: 549.31 }],
  hsnB2c: [{ hsnCode: "27101980", uqc: "BOX-BOX", rate: 18, qty: 74, taxable: 54856.74, cgst: 4937.13, sgst: 4937.13, igst: 0 }],
  docs: [
    { docType: "Invoices for outward supply", firstNo: "GSTAL/893", lastNo: "GSTAL/1079", issued: 187, cancelled: 0 },
    { docType: "Credit Note", firstNo: "CN/202610/0001", lastNo: "CN/202610/0001", issued: 1, cancelled: 0 },
  ],
  totals: { invoices: 189, taxable: 1741834.84, tax: 313530.16 },
};

function sheetAoa(wb: XLSX.WorkBook, name: string): unknown[][] {
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, blankrows: true }) as unknown[][];
}

describe("buildGstr1Workbook", () => {
  const wb = XLSX.read(new Uint8Array(buildGstr1Workbook(DATA)), { type: "array" });

  it("emits the COMPLETE 32-sheet template in the template's own order", () => {
    expect(wb.SheetNames).toEqual([
      "Help Instruction", "b2b,sez,de", "b2ba", "b2cl", "b2cla", "b2cs", "b2csa", "cdnr", "cdnra",
      "cdnur", "cdnura", "exp", "expa", "at", "ata", "atadj", "atadja", "exemp", "hsn(b2b)", "hsn(b2c)",
      "docs", "eco", "ecoa", "ecob2b", "ecourp2b", "ecob2c", "ecourp2c", "ecoab2b", "ecoab2c",
      "ecoaurp2b", "ecoaurp2c", "master",
    ]);
  });

  it("ships the master + Help reference sheets from the skeleton", () => {
    expect(wb.SheetNames).toContain("master");
    expect(sheetAoa(wb, "master").length).toBeGreaterThan(1);
    expect(sheetAoa(wb, "Help Instruction").length).toBeGreaterThan(1);
    // An untouched section sheet (no exports) still carries its header skeleton.
    expect(sheetAoa(wb, "exp").length).toBeGreaterThan(0);
  });

  it("sizes each column to its widest cell (ragged rows handled)", () => {
    const cols = autoColumnWidths([
      ["GSTIN/UIN of Recipient", "Rate"],
      ["36ABCDE1001F1ZC"],
      ["x", 18, "extra-wide-tail-value"],
    ]);
    expect(cols).toHaveLength(3); // widest row drives the column count
    expect(cols[0].wch).toBe("GSTIN/UIN of Recipient".length + 1); // 23
    expect(cols[1].wch).toBe("Rate".length + 1); // 5 (number 18 is shorter)
    expect(cols[2].wch).toBe("extra-wide-tail-value".length + 1);
  });

  it("places the b2b header at row 4 with the exact GSTN columns", () => {
    const aoa = sheetAoa(wb, "b2b,sez,de");
    expect(aoa[3]).toEqual([
      "GSTIN/UIN of Recipient", "Receiver Name", "Invoice Number", "Invoice date", "Invoice Value",
      "Place Of Supply", "Reverse Charge", "Applicable % of Tax Rate", "Invoice Type", "E-Commerce GSTIN",
      "Rate", "Taxable Value", "Cess Amount",
    ]);
  });

  it("formats the first b2b data row (date dd-Mon-yyyy, POS code-Name, type)", () => {
    const row = sheetAoa(wb, "b2b,sez,de")[4];
    expect(row[0]).toBe("36AYJPC8376L1ZU");
    expect(row[2]).toBe("GSTAL/895");
    expect(row[3]).toBe("01-Oct-2026");
    expect(row[5]).toBe("36-Telangana"); // canonical spelling, not the data's "Telengana"
    expect(row[6]).toBe("N");
    expect(row[8]).toBe("Regular B2B");
    expect(row[10]).toBe(18);
    expect(row[11]).toBe(16271.18);
  });

  it("computes the b2b summary (distinct recipients/invoices, deduped invoice value, taxable)", () => {
    const summary = sheetAoa(wb, "b2b,sez,de")[2];
    expect(summary[0]).toBe(2); // 2 distinct GSTINs
    expect(summary[2]).toBe(2); // 2 distinct invoices (GSTAL/896 counted once)
    expect(summary[4]).toBe(42800); // 19200 + 23600 (invoice value not double-counted across rates)
    expect(summary[11]).toBe(37271.18); // 16271.18 + 20000 + 1000
  });

  it("renders an inter-state B2CL row with IGST", () => {
    const row = sheetAoa(wb, "b2cl")[4];
    expect(row).toEqual(["IGSAL/5", "05-Oct-2026", 300000, "29-Karnataka", "", 18, 254237.29, 0, ""]);
  });

  it("marks credit notes as type C", () => {
    const row = sheetAoa(wb, "cdnr")[4];
    expect(row[2]).toBe("CN/202610/0001");
    expect(row[4]).toBe("C");
    expect(row[8]).toBe(1180); // note value
  });

  it("always lays out the four exemp categories with the value under Exempted", () => {
    const aoa = sheetAoa(wb, "exemp");
    expect(aoa[3]).toEqual(["Description", "Nil Rated Supplies", "Exempted(other than nil rated/non GST supply)", "Non-GST Supplies"]);
    // unreg + intra → fourth category row; value in the Exempted column (index 2).
    expect(aoa[7]).toEqual(["Intra-State supplies to unregistered persons", 0, 2500, 0]);
    expect(aoa[2][2]).toBe(2500); // total exempted
  });

  it("computes HSN Total Value as taxable + tax", () => {
    const row = sheetAoa(wb, "hsn(b2b)")[4];
    expect(row[0]).toBe("27101980");
    expect(row[2]).toBe("BOX-BOX");
    expect(row[3]).toBe(17); // qty
    expect(row[4]).toBe(22017); // 18658.47 + 1404.61 + 1404.61 + 549.31
    expect(row[7]).toBe(549.31); // integrated tax
  });

  it("lists only document types that were issued", () => {
    const aoa = sheetAoa(wb, "docs");
    expect(aoa[4]).toEqual(["Invoices for outward supply", "GSTAL/893", "GSTAL/1079", 187, 0]);
    expect(aoa[5]).toEqual(["Credit Note", "CN/202610/0001", "CN/202610/0001", 1, 0]);
    expect(aoa[2][3]).toBe(188); // total number issued
  });
});
