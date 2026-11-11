import { describe, expect, it } from "vitest";
import {
  bucketFromAge,
  getAdminDuesSummary,
  getDuesByExecutive,
  getMyDuesSummary,
  listAdminDuesCustomers,
  listMyDuesCustomers,
  runDuesMaintenance,
  setEnterpriseDuesBands,
  validateDuesBands,
  type DuesBandInput,
} from "./dues";
import { makeSql, calledTag } from "../test/sql-mock";

const FOUR: DuesBandInput[] = [
  { fromDays: 0, toDays: 15, label: "Current" },
  { fromDays: 16, toDays: 40, label: "Watch" },
  { fromDays: 41, toDays: 60, label: "Due" },
  { fromDays: 61, toDays: null, label: "Overdue" },
];

describe("validateDuesBands", () => {
  it("accepts exactly 4 contiguous bands (0 → ∞)", () => {
    expect(() => validateDuesBands(FOUR)).not.toThrow();
  });
  it("rejects a count other than 4", () => {
    expect(() => validateDuesBands(FOUR.slice(0, 3))).toThrow(/Exactly 4/);
  });
  it("rejects a first band not starting at 0", () => {
    expect(() => validateDuesBands([{ ...FOUR[0], fromDays: 1 }, ...FOUR.slice(1)])).toThrow(/start at day 0/);
  });
  it("rejects a last band that is not open-ended", () => {
    expect(() => validateDuesBands([...FOUR.slice(0, 3), { ...FOUR[3], toDays: 90 }])).toThrow(/open-ended/);
  });
  it("rejects a gap/overlap between bands", () => {
    const gap = [FOUR[0], { ...FOUR[1], fromDays: 20 }, FOUR[2], FOUR[3]];
    expect(() => validateDuesBands(gap)).toThrow(/start the day after/);
  });
  it("rejects a blank label", () => {
    expect(() => validateDuesBands([{ ...FOUR[0], label: "  " }, ...FOUR.slice(1)])).toThrow(/needs a label/);
  });
});

describe("setEnterpriseDuesBands", () => {
  it("validates then clears + inserts the 4 bands in one transaction", async () => {
    const sql = makeSql({ dues_bands_load: FOUR.map((b, i) => ({ ordinal: i, fromDays: b.fromDays, toDays: b.toDays, label: b.label })) });
    const saved = await setEnterpriseDuesBands(sql, FOUR);
    expect(calledTag(sql, "dues_bands_clear")).toBe(true);
    expect(sql.calls.filter((c) => c.tag === "dues_bands_insert")).toHaveLength(4);
    expect(saved).toHaveLength(4);
  });
  it("rejects an invalid set before writing anything", async () => {
    const sql = makeSql();
    await expect(setEnterpriseDuesBands(sql, FOUR.slice(0, 2))).rejects.toMatchObject({ status: 422 });
    expect(calledTag(sql, "dues_bands_clear")).toBe(false);
  });
});

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
    // No dues_bands_load mock → default bands keyed by ordinal ("0".."3").
    expect(out.buckets.find((b) => b.key === "0")).toMatchObject({ customers: 2, outstanding: 1000 });
    expect(out.buckets.find((b) => b.key === "3")).toMatchObject({ customers: 1, outstanding: 0 });
    expect(out.bands).toHaveLength(4);
    expect(out.totalCustomers).toBe(3);
  });
});

describe("listMyDuesCustomers", () => {
  it("422s an unknown bucket, else maps the drill-down", async () => {
    await expect(listMyDuesCustomers(makeSql(), { userId: "se-1" }, "bogus")).rejects.toMatchObject({ status: 422 });
    // oldestInvoiceDate as a Date exercises str()'s Date → ISO branch
    const sql = makeSql({ dues_customers_for_se: [{ customerId: "c1", customerName: "Ravi", oldestInvoiceDate: new Date("2026-04-01T00:00:00Z"), ageDays: "70", outstanding: "500" }] });
    const rows = await listMyDuesCustomers(sql, { userId: "se-1" }, "3");
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
    // No dues_bands_load mock → default bands keyed by ordinal ("0".."3").
    expect(out.buckets.find((b) => b.key === "0")!.customers).toBe(2);
    expect(out.buckets.find((b) => b.key === "3")!.customers).toBe(1);
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
    await expect(listAdminDuesCustomers(makeSql(), "bogus")).rejects.toMatchObject({ status: 422 });
    const sql = makeSql({
      dues_customers_admin: [{ customerId: "c1", customerName: "Ravi", city: "Hyd", executiveName: null, bandOldestDate: "2026-04-01", bandAgeDays: "70", bandOutstanding: "500", totalOutstanding: "800" }],
    });
    // "3" = the last default band's ordinal key (no dues_bands_load mock).
    const rows = await listAdminDuesCustomers(sql, "3", { executiveId: "se-1", city: "Hyd" });
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
