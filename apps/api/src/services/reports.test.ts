import { afterEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  getCustomerAnalytics: vi.fn().mockResolvedValue({ customers: [{ customerId: "c1" }] }),
  getSkuAnalytics: vi.fn().mockResolvedValue({
    oils: [{ brand: "Fuchs", sku: "A" }, { brand: "Savsol", sku: "B" }],
    months: [{ month: "2026-06", value: 100 }],
    brands: [{ name: "Fuchs", invoices: 3 }, { name: "Unmatched", invoices: 1 }],
  }),
  buildCancelled: vi.fn().mockResolvedValue({ segments: [], oils: [] }),
  buildReturned: vi.fn().mockResolvedValue({ segments: [], oils: [] }),
  getAttendanceSummary: vi.fn().mockResolvedValue({ rows: [] }),
  buildCustomerProductivity: vi.fn().mockResolvedValue({ rows: [] }),
  buildProductivityTrend: vi.fn().mockResolvedValue({ points: [] }),
  buildVisitsTrend: vi.fn().mockResolvedValue({ points: [] }),
}));
vi.mock("./dashboard-analytics", () => ({ getCustomerAnalytics: h.getCustomerAnalytics }));
vi.mock("./sku-analytics", () => ({ getSkuAnalytics: h.getSkuAnalytics }));
vi.mock("./reports-adjustments", () => ({ buildCancelled: h.buildCancelled, buildReturned: h.buildReturned }));
vi.mock("./attendance", () => ({ getAttendanceSummary: h.getAttendanceSummary }));
vi.mock("./reports-visits", () => ({
  buildCustomerProductivity: h.buildCustomerProductivity,
  buildProductivityTrend: h.buildProductivityTrend,
  buildVisitsTrend: h.buildVisitsTrend,
}));

import {
  buildBrandsSummary,
  buildOneReport,
  buildSummary,
  isReportKey,
  REPORT_KEYS,
  resolvePeriod,
  resolveWindow,
  type ReportKey,
} from "./reports";
import { makeSql } from "../test/sql-mock";

afterEach(() => vi.clearAllMocks());

describe("resolvePeriod", () => {
  it("daily = the anchor day", () => {
    expect(resolvePeriod("daily", "2026-06-10")).toMatchObject({ start: "2026-06-10", end: "2026-06-10" });
  });
  it("weekly = the previous Mon–Sun", () => {
    expect(resolvePeriod("weekly", "2026-06-17")).toMatchObject({ start: "2026-06-08", end: "2026-06-14" });
  });
  it("fortnightly, second half of month → 1st–15th", () => {
    expect(resolvePeriod("fortnightly", "2026-06-20")).toMatchObject({ start: "2026-06-01", end: "2026-06-15" });
  });
  it("fortnightly, first half → 16th–end of previous month", () => {
    expect(resolvePeriod("fortnightly", "2026-06-10")).toMatchObject({ start: "2026-05-16", end: "2026-05-31" });
  });
  it("monthly = the whole previous month", () => {
    expect(resolvePeriod("monthly", "2026-06-10")).toMatchObject({ start: "2026-05-01", end: "2026-05-31" });
  });
});

describe("resolveWindow", () => {
  it("an explicit from/to range overrides the cadence (order-tolerant)", () => {
    expect(resolveWindow({ cadence: "monthly", from: "2026-06-01", to: "2026-06-30" }, "2026-07-01").period)
      .toMatchObject({ start: "2026-06-01", end: "2026-06-30" });
    // reversed range is swapped
    expect(resolveWindow({ cadence: "monthly", from: "2026-06-30", to: "2026-06-01" }, "2026-07-01").period)
      .toMatchObject({ start: "2026-06-01", end: "2026-06-30" });
  });
  it("uses the anchor (or today when the anchor is not a date) otherwise", () => {
    expect(resolveWindow({ cadence: "daily", anchor: "2026-06-10" }, "2026-07-01").anchor).toBe("2026-06-10");
    expect(resolveWindow({ cadence: "daily", anchor: "bad" }, "2026-07-01").anchor).toBe("2026-07-01");
  });
});

describe("isReportKey", () => {
  it("recognises valid keys and rejects others", () => {
    expect(isReportKey("sales")).toBe(true);
    expect(isReportKey("nope")).toBe(false);
    expect(REPORT_KEYS).toContain("attendanceSummary");
  });
});

function fullSql() {
  return makeSql({
    // today as a Date exercises str()'s Date → ISO branch.
    reports_ist_now: [{ today: new Date("2026-06-30T00:00:00Z"), stamp: "30 Jun 2026, 12:00" }],
    reports_active_ses: [{ id: "se-1", name: "Asha" }],
    reports_active_field_users: [{ id: "se-1", name: "Asha", role: "SALES_EXECUTIVE" }],
    reports_sales_by_segment: [
      { userId: "se-1", segment: "Car", litres: "10" },
      { userId: "se-1", segment: "3W", litres: null }, // null litres → num() 0 fallback
      { userId: "", segment: "Car", litres: "5" }, // no user → skipped
      { userId: "se-1", segment: "", litres: "5" }, // no segment → skipped
    ],
    reports_collections_by_customer_segment: [
      { userId: "se-1", segment: "Car,2W", amount: "100" }, // split across 2
      { userId: "se-1", segment: "", amount: "50" }, // → Unspecified bucket
      { userId: "", segment: "Car", amount: "99" }, // no user → skipped
    ],
    reports_distance: [{ userId: "se-1", km: "12.345" }, { userId: null, km: "1" }], // null userId → str() "" fallback

    reports_onboarding: [{ userId: "se-1", n: "3" }],
    reports_oils_by_segment: [
      { segment: "Car", product: "Titan", litres: "10", quantity: "5", orders: "2", customers: "2" },
      { segment: "", product: "x", litres: "5" }, // no segment → skipped
      { segment: "Car", product: "y", litres: "0" }, // zero litres → skipped
    ],
    reports_backlog_undelivered: [
      { userId: "se-1", seName: "Asha", invoiceNo: "INV-1", customer: "Ravi", invoiceDate: "2026-06-01", value: "1000", ageDays: "5" },
      { userId: "", seName: "Unassigned", invoiceNo: "INV-2", customer: "X", invoiceDate: "2026-06-02", value: "500", ageDays: "4" },
    ],
    reports_ordered_not_invoiced: [
      { orderCode: "ORD-1", userId: "se-1", seName: "Asha", customer: "Ravi", remaining: "20.44" },
      { orderCode: "ORD-2", userId: "", seName: "Unassigned", customer: "X", remaining: "5" },
    ],
    reports_collections_trend: [{ month: "2026-06", total: "5000" }],
  });
}

describe("buildOneReport", () => {
  it("builds every report key without error and fills its slice", async () => {
    for (const key of REPORT_KEYS) {
      const slice = await buildOneReport(fullSql(), { cadence: "monthly" }, key as ReportKey);
      expect(slice.period).toBeDefined();
      expect(slice.generatedAt).toBe("30 Jun 2026, 12:00");
    }
  });

  it("sales: pivots per-SE segment litres (skips blank user/segment)", async () => {
    const slice = await buildOneReport(fullSql(), { cadence: "monthly" }, "sales");
    const asha = slice.sales!.rows.find((r) => r.userId === "se-1")!;
    expect(asha.segments.Car).toBe(10);
    expect(asha.total).toBe(10);
  });

  it("collections: splits a multi-segment amount and buckets blank as Unspecified", async () => {
    const slice = await buildOneReport(fullSql(), { cadence: "monthly" }, "collections");
    const asha = slice.collections!.rows.find((r) => r.userId === "se-1")!;
    expect(asha.segments.Car).toBe(50); // 100 / 2
    expect(asha.segments["2W"]).toBe(50);
    expect(asha.segments.Unspecified).toBe(50);
    expect(slice.collections!.segments).toContain("Unspecified");
  });

  it("distance: rounds km to 2dp per field user", async () => {
    const slice = await buildOneReport(fullSql(), { cadence: "monthly" }, "distance");
    expect(slice.distance!.rows[0].km).toBe(12.35);
  });

  it("oils: ranks products within a segment with share %", async () => {
    const slice = await buildOneReport(fullSql(), { cadence: "monthly" }, "oils");
    const car = slice.oils!.groups.find((g) => g.segment === "Car")!;
    expect(car.totalLitres).toBe(10);
    expect(car.products[0]).toMatchObject({ product: "Titan", share: 100 });
  });

  it("backlog + ordered: group by SE with an 'unassigned' bucket", async () => {
    const backlog = await buildOneReport(fullSql(), { cadence: "monthly" }, "backlog");
    expect(backlog.backlog!.totalCount).toBe(2);
    expect(backlog.backlog!.groups.some((g) => g.userId === null)).toBe(true);
    const ordered = await buildOneReport(fullSql(), { cadence: "monthly" }, "ordered");
    expect(ordered.orderedNotInvoiced!.totalCount).toBe(2);
  });

  it("oilsSku filters by the selected brand; trend keeps all brands", async () => {
    const sku = await buildOneReport(fullSql(), { cadence: "monthly", brand: "Fuchs" }, "oilsSku");
    expect(sku.oilsSku).toEqual([{ brand: "Fuchs", sku: "A" }]);
    const trend = await buildOneReport(fullSql(), { cadence: "monthly", brand: "all" }, "trend");
    expect(trend.trend).toEqual([{ month: "2026-06", value: 100 }]);
  });

  it("collectionsTrend maps the trailing months", async () => {
    const slice = await buildOneReport(fullSql(), { cadence: "monthly" }, "collectionsTrend");
    expect(slice.collectionsTrend!.months).toEqual([{ month: "2026-06", total: 5000 }]);
  });

  it("delegates the external-service reports to their builders", async () => {
    await buildOneReport(fullSql(), { cadence: "monthly" }, "customers");
    await buildOneReport(fullSql(), { cadence: "monthly" }, "cancelled");
    await buildOneReport(fullSql(), { cadence: "monthly" }, "attendanceSummary");
    expect(h.getCustomerAnalytics).toHaveBeenCalled();
    expect(h.buildCancelled).toHaveBeenCalled();
    expect(h.getAttendanceSummary).toHaveBeenCalled();
  });
});

describe("buildSummary", () => {
  it("aggregates the headline KPIs", async () => {
    const sql = makeSql({
      reports_ist_now: [{ today: "2026-06-30", stamp: "30 Jun 2026, 12:00" }],
      reports_sum_oil: [{ litres: "500", segments: "3" }],
      reports_sum_collected: [{ v: "90000" }],
      reports_sum_distance: [{ v: "123.456" }],
      reports_sum_customers: [{ v: "4" }],
      reports_sum_backlog: [{ c: "2", v: "1500" }],
      reports_sum_pending: [{ c: "3", l: "40.44" }],
      reports_sum_execs: [{ v: "5" }],
      reports_sum_field: [{ v: "7" }],
      reports_sum_cust_active: [{ v: "12" }],
      reports_sum_billed: [{ c: "9", v: "100000", t: "85000" }],
    });
    const { summary } = await buildSummary(sql, { cadence: "monthly", brand: "Fuchs" });
    expect(summary).toMatchObject({
      oilLitres: 500,
      oilSegments: 3,
      collected: 90000,
      distanceKm: 123.5,
      newCustomers: 4,
      backlogValue: 1500,
      backlogCount: 2,
      pendingOrders: 3,
      pendingLitres: 40.4,
      execCount: 5,
      fieldCount: 7,
      customersReported: 12,
      billedInvoices: 9,
      invoicedPreGst: 85000,
      invoicedWithGst: 100000,
    });
  });
});

describe("buildBrandsSummary", () => {
  it("folds per-brand ordered/pending/cancelled/returned + billed into teasers", async () => {
    const sql = makeSql({
      reports_ist_now: [{ today: "2026-06-30", stamp: "30 Jun 2026, 12:00" }],
      reports_brands_ordered: [{ brand: "Fuchs", litres: "100" }, { brand: "", litres: "9" }], // blank skipped
      reports_brands_pending: [{ brand: "Fuchs", orders: "2", litres: "12.34" }],
      reports_brands_cancelled: [{ brand: "Fuchs", litres: "3" }],
      reports_brands_returned: [{ brand: "Fuchs", litres: "1" }],
    });
    const { brands } = await buildBrandsSummary(sql, { cadence: "monthly" });
    expect(brands.Fuchs).toMatchObject({
      oilLitres: 100,
      pendingOrders: 2,
      pendingLitres: 12.3,
      cancelledLitres: 3,
      returnedLitres: 1,
      billedInvoices: 3, // from the mocked SKU rollup (Unmatched ignored)
    });
    expect(brands[""]).toBeUndefined();
  });
});
