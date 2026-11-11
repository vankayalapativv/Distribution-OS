import { describe, expect, it } from "vitest";
import {
  bucketFromAge,
  getAdminDuesSummary,
  getDuesByExecutive,
  getMyDuesSummary,
  listAdminDuesCustomers,
  listMyDuesCustomers,
  runDuesMaintenance,
} from "./dues";
import { makeSql, calledTag } from "../test/sql-mock";

describe("bucketFromAge", () => {
  it("maps age-days to the four bands (null/negative → null)", () => {
    expect(bucketFromAge(null)).toBeNull();
    expect(bucketFromAge(-1)).toBeNull();
    expect(bucketFromAge(Number.NaN)).toBeNull();
    expect(bucketFromAge(10)).toBe("0_30");
    expect(bucketFromAge(40)).toBe("30_45");
    expect(bucketFromAge(55)).toBe("45_60");
    expect(bucketFromAge(99)).toBe("60_plus");
  });
});

describe("getMyDuesSummary", () => {
  it("maps bucket rows and totals (null outstanding → 0)", async () => {
    const sql = makeSql({ dues_summary_for_se: [{ bucket: 0, customers: 2, outstanding: "1000" }, { bucket: 3, customers: 1, outstanding: null }] });
    const out = await getMyDuesSummary(sql, { userId: "se-1" });
    expect(out.buckets.find((b) => b.key === "0_30")).toMatchObject({ customers: 2, outstanding: 1000 });
    expect(out.buckets.find((b) => b.key === "60_plus")).toMatchObject({ customers: 1, outstanding: 0 });
    expect(out.totalCustomers).toBe(3);
  });
});

describe("listMyDuesCustomers", () => {
  it("422s an unknown bucket, else maps the drill-down", async () => {
    await expect(listMyDuesCustomers(makeSql(), { userId: "se-1" }, "bogus" as never)).rejects.toMatchObject({ status: 422 });
    // oldestInvoiceDate as a Date exercises str()'s Date → ISO branch
    const sql = makeSql({ dues_customers_for_se: [{ customerId: "c1", customerName: "Ravi", oldestInvoiceDate: new Date("2026-04-01T00:00:00Z"), ageDays: "70", outstanding: "500" }] });
    const rows = await listMyDuesCustomers(sql, { userId: "se-1" }, "60_plus");
    expect(rows[0]).toMatchObject({ customerId: "c1", oldestInvoiceDate: "2026-04-01", ageDays: 70, outstanding: 500 });
  });
});

describe("getAdminDuesSummary", () => {
  it("reads grouping-sets rows into buckets + totals (with SE/city filter)", async () => {
    const sql = makeSql({
      dues_summary_admin: [
        { isTotal: 0, bucket: 0, customers: 2, outstanding: "1000" },
        { isTotal: 0, bucket: 3, customers: 1, outstanding: "500" },
        { isTotal: 1, bucket: null, customers: 3, outstanding: "1500" },
      ],
    });
    const out = await getAdminDuesSummary(sql, { executiveId: "se-1", city: "Hyderabad" });
    expect(out.totalCustomers).toBe(3);
    expect(out.totalOutstanding).toBe(1500);
    expect(out.buckets.find((b) => b.key === "0_30")!.customers).toBe(2);
  });
});

describe("getDuesByExecutive", () => {
  it("maps per-SE dues rows", async () => {
    const sql = makeSql({ dues_by_executive: [{ executiveId: "se-1", executiveName: "Asha", customerCount: "4", totalOutstanding: "9000" }] });
    expect((await getDuesByExecutive(sql))[0]).toMatchObject({ executiveId: "se-1", customerCount: 4, totalOutstanding: 9000 });
  });
});

describe("listAdminDuesCustomers", () => {
  it("422s an unknown bucket, else maps band + legacy-alias fields", async () => {
    await expect(listAdminDuesCustomers(makeSql(), "bogus" as never)).rejects.toMatchObject({ status: 422 });
    const sql = makeSql({
      dues_customers_admin: [{ customerId: "c1", customerName: "Ravi", city: "Hyd", executiveName: null, bandOldestDate: "2026-04-01", bandAgeDays: "70", bandOutstanding: "500", totalOutstanding: "800" }],
    });
    const rows = await listAdminDuesCustomers(sql, "60_plus", { executiveId: "se-1", city: "Hyd" });
    expect(rows[0]).toMatchObject({ customerId: "c1", bandOutstanding: 500, totalOutstanding: 800, ageDays: 70, outstanding: 500 });
  });
});

describe("runDuesMaintenance", () => {
  it("no-ops when the daily gate is not claimed", async () => {
    const sql = makeSql({ dues_daily_gate: [{ claimed: false }] });
    expect(await runDuesMaintenance(sql, { now: "2026-06-01T10:00:00Z" })).toEqual({ ran: false, crossings: 0, pushes: [] });
  });

  it("notifies SEs + pushes on an upward bucket crossing", async () => {
    const sql = makeSql({
      dues_daily_gate: [{ claimed: true }],
      dues_compute_all: [
        { customerId: "c1", customerName: "Ravi", oldestInvoiceDate: "2026-04-01", ageDays: 70, outstanding: "500", newBucket: 3, oldBucket: 1, seId: "se-1" }, // upward crossing
        { customerId: "c2", customerName: "Kumar", oldestInvoiceDate: "2026-06-01", ageDays: 5, outstanding: "100", newBucket: 0, oldBucket: null, seId: "se-1" }, // first sight → no crossing
      ],
      dues_push_tokens: [{ userId: "se-1", token: "tokA" }],
    });
    const res = await runDuesMaintenance(sql, { now: "2026-06-01T10:00:00Z" });
    expect(res.ran).toBe(true);
    expect(res.crossings).toBe(1);
    expect(res.pushes[0].tokens).toEqual(["tokA"]);
    expect(calledTag(sql, "dues_crossing_notifications")).toBe(true);
    expect(calledTag(sql, "dues_state_upsert")).toBe(true);
    expect(calledTag(sql, "dues_state_clear")).toBe(true);
  });

  it("runs the state upkeep with no crossings", async () => {
    const sql = makeSql({ dues_daily_gate: [{ claimed: true }], dues_compute_all: [] });
    const res = await runDuesMaintenance(sql, { now: "2026-06-01T10:00:00Z" });
    expect(res).toMatchObject({ ran: true, crossings: 0, pushes: [] });
  });
});
