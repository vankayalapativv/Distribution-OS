import { describe, it, expect } from "vitest";
import { summaryFigures, generateState, type SummaryProps } from "./invoice-generate-summary";
import type { InvoiceFormLine } from "./invoice-generate-api";

const line = (over: Partial<InvoiceFormLine> = {}): InvoiceFormLine => ({
  uid: "u", productId: "p", productName: "P", packSizeLitres: 1, brand: null, segment: null, hsnCode: null,
  qty: "0", rate: "", mrp: "", discountPct: "0", orderItemId: null, maxUnits: null, ...over,
});

const props = (over: Partial<SummaryProps> = {}): SummaryProps => ({
  lines: [], supply: "intra", stockMap: new Map(), balancesReady: false,
  hasCustomer: true, godownName: "G1", editing: false, transportCharge: "", onTransportChange: () => {},
  busy: false, error: null, onGenerate: () => {}, ...over,
});

describe("summaryFigures", () => {
  it("is all zeros with no priced lines", () => {
    expect(summaryFigures([], "intra")).toEqual({ taxable: 0, cgst: 0, sgst: 0, gst: 0, transport: 0, grand: 0, litres: 0 });
  });
  it("totals a priced line with 18% GST (intra split)", () => {
    const f = summaryFigures([line({ qty: "2", rate: "100", packSizeLitres: 5 })], "intra");
    expect(f).toMatchObject({ taxable: 200, gst: 36, cgst: 18, sgst: 18, grand: 236, litres: 10 });
  });
  it("adds the transport charge straight to the grand total (no GST)", () => {
    const f = summaryFigures([line({ qty: "2", rate: "100" })], "intra", 150);
    expect(f).toMatchObject({ taxable: 200, gst: 36, transport: 150, grand: 386 });
  });
  it("ignores unpriced lines in the taxable total", () => {
    expect(summaryFigures([line({ qty: "2", rate: "" })], "intra").taxable).toBe(0);
  });
});

describe("generateState", () => {
  it("blocks and prompts for a rate when lines are empty", () => {
    const s = generateState(props({ lines: [] }));
    expect(s.blocked).toBe(true);
    expect(s.label).toBe("Set a rate on every line");
  });
  it("allows generate when everything is priced and valid", () => {
    const s = generateState(props({ lines: [line({ qty: "1", rate: "50" })] }));
    expect(s.blocked).toBe(false);
    expect(s.label).toBe("Generate & deduct stock");
  });
  it("shows Save changes when editing a valid invoice", () => {
    expect(generateState(props({ editing: true, lines: [line({ qty: "1", rate: "50" })] })).label).toBe("Save changes");
  });
  it("blocks on short stock", () => {
    const l = line({ qty: "5", rate: "10", productId: "p", packSizeLitres: 1 });
    const s = generateState(props({ balancesReady: true, stockMap: new Map([["p|1", 2]]), lines: [l] }));
    expect(s.shortCount).toBe(1);
    expect(s.label).toBe("Fix 1 short line to generate");
    expect(s.blocked).toBe(true);
  });
  it("blocks on over-billed order lines", () => {
    const s = generateState(props({ lines: [line({ qty: "5", rate: "10", maxUnits: 3 })] }));
    expect(s.label).toBe("Fix 1 over-billed line to generate");
    expect(s.blocked).toBe(true);
  });
  it("blocks when no customer is selected", () => {
    expect(generateState(props({ hasCustomer: false, lines: [line({ qty: "1", rate: "50" })] })).blocked).toBe(true);
  });
});
