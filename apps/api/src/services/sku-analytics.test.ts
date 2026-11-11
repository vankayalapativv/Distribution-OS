import { describe, expect, it } from "vitest";
import { baseProductName, getSkuAnalytics } from "./sku-analytics";
import { makeSql } from "../test/sql-mock";

describe("baseProductName", () => {
  it("strips a trailing pack token (one token or split number+unit)", () => {
    expect(baseProductName("SILKOLENE SUPER 4 SAE 10W30 900ML")).toBe("SILKOLENE SUPER 4 SAE 10W30");
    expect(baseProductName("FOO BAR 7.5LTR")).toBe("FOO BAR");
    expect(baseProductName("FOO BAR 1L.")).toBe("FOO BAR");
    expect(baseProductName("FOO BAR 900 ML")).toBe("FOO BAR"); // split token
  });
  it("leaves a name without a trailing pack untouched", () => {
    expect(baseProductName("SINGLE")).toBe("SINGLE"); // < 2 tokens
    expect(baseProductName("FOO BAR")).toBe("FOO BAR"); // no pack token
    expect(baseProductName("900 ML")).toBe("900 ML"); // only 2 tokens → not stripped
  });
});

const RANGE = { from: "2026-06-01", to: "2026-06-30" };

const DATA = {
  sku_analytics_lines: [
    { description: "SILKOLENE SUPER 4 SAE 10W30 900ML", qty: "10", litres: "9", price: "100", invoiceId: "inv-1", customerId: "c1", customerName: "Ravi" },
    { description: "SILKOLENE SUPER 4 SAE 10W30 1L.", qty: "5", litres: "5", price: "200", invoiceId: "inv-2", customerId: "c2", customerName: "Kumar" },
    // unmatched product + a zero-litre pack (→ packLitresPerUnit null)
    { description: "UNKNOWN OIL 500ML", qty: "2", litres: "0", price: "50", invoiceId: "inv-3", customerId: "c1", customerName: "Ravi" },
  ],
  sku_analytics_return_lines: [
    { description: "SILKOLENE SUPER 4 SAE 10W30 900ML", kind: "oil", qty: "2", litres: "1.8", beforeGst: "200", invoiceId: "inv-1", customerId: "c1", customerName: "Ravi" },
  ],
  sku_analytics_catalogue: [
    { name: "SILKOLENE SUPER 4 SAE 10W30", brand: "Fuchs", segment: "Car" },
  ],
  sku_analytics_trend: [
    { month: "2026-05", litres: "50", beforeGst: "10000" },
    { month: "2026-06", litres: "100", beforeGst: "20000" },
  ],
  sku_analytics_return_trend: [{ month: "2026-06", litres: "10", beforeGst: "2000" }],
};

describe("getSkuAnalytics", () => {
  it("aggregates billed-minus-returned per base product with packs + top buyers", async () => {
    const out = await getSkuAnalytics(makeSql(DATA), RANGE);
    const silk = out.oils.find((o) => o.name === "SILKOLENE SUPER 4 SAE 10W30")!;
    expect(silk.brand).toBe("Fuchs");
    expect(silk.litres).toBe(12.2); // 9 + 5 − 1.8
    expect(silk.quantity).toBe(13); // 10 + 5 − 2
    expect(silk.beforeGst).toBe(1800); // 1000 + 1000 − 200
    expect(silk.invoices).toBe(2); // returns don't count toward invoice tally
    expect(silk.customers).toBe(2);
    // packs sorted by litres desc
    expect(silk.packs[0].description).toBe("SILKOLENE SUPER 4 SAE 10W30 900ML");
    expect(silk.packs[0].packLitresPerUnit).toBeCloseTo(0.9, 5);
    // top buyers sorted by beforeGst desc: Kumar (1000) before Ravi (800)
    expect(silk.topBuyers.map((b) => b.customerName)).toEqual(["Kumar", "Ravi"]);
  });

  it("leaves an unmatched product with a null brand and a null pack-per-unit", async () => {
    const out = await getSkuAnalytics(makeSql(DATA), RANGE);
    const unknown = out.oils.find((o) => o.name === "UNKNOWN OIL")!;
    expect(unknown.brand).toBeNull();
    expect(unknown.packs[0].packLitresPerUnit).toBeNull(); // litres 0 → null
  });

  it("rolls up brands + segments (matched names and Unmatched)", async () => {
    const out = await getSkuAnalytics(makeSql(DATA), RANGE);
    expect(out.brands.map((b) => b.name).sort()).toEqual(["Fuchs", "Unmatched"]);
    expect(out.segments.map((s) => s.name).sort()).toEqual(["Car", "Unmatched"]);
  });

  it("nets returns out of the six-month trend and totals", async () => {
    const out = await getSkuAnalytics(makeSql(DATA), RANGE);
    const jun = out.months.find((m) => m.month === "2026-06")!;
    expect(jun).toMatchObject({ litres: 90, beforeGst: 18000 }); // 100−10, 20000−2000
    const may = out.months.find((m) => m.month === "2026-05")!;
    expect(may).toMatchObject({ litres: 50, beforeGst: 10000 }); // no returns that month
    expect(out.totals).toMatchObject({ litres: 12.2, invoices: 3 });
  });

  it("coerces a Date customer name (→ ISO) and a null price (→ 0)", async () => {
    const d = new Date("2026-06-01T00:00:00Z");
    const out = await getSkuAnalytics(
      makeSql({
        sku_analytics_lines: [{ description: "ACME OIL 1L", qty: "2", litres: "2", price: null, invoiceId: "inv-1", customerId: "c1", customerName: d }],
        // a null catalogue name exercises str()'s non-string/non-Date "" fallback
        sku_analytics_catalogue: [{ name: null, brand: null, segment: null }],
      }),
      RANGE,
    );
    const acme = out.oils.find((o) => o.name === "ACME OIL")!;
    expect(acme.beforeGst).toBe(0); // price null → num() 0
    expect(acme.topBuyers[0].customerName).toBe(d.toISOString()); // Date → str() ISO
  });

  it("returns empty rollups when there are no lines", async () => {
    const out = await getSkuAnalytics(makeSql({}), RANGE);
    expect(out.oils).toEqual([]);
    expect(out.totals).toEqual({ litres: 0, beforeGst: 0, invoices: 0 });
  });
});
