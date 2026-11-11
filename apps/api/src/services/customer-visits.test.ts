import { describe, expect, it } from "vitest";
import { getCustomerVisits } from "./customer-visits";
import { makeSql } from "../test/sql-mock";

describe("getCustomerVisits", () => {
  it("assembles summary, rows, missed beats and per-role stats", async () => {
    const sql = makeSql({
      customer_visits_summary: [{ today: 1, week: 2, month: 3, all: 5 }],
      customer_visits_count: [{ total: 5, avgDuration: 20, productive: 3 }],
      customer_visits_rows: [{
        id: "v1", visitDate: new Date("2026-06-01T00:00:00Z"), checkInTime: new Date("2026-06-01T09:00:00Z"),
        checkOutTime: null, durationMinutes: 30, noOutcomeReason: null, executiveName: "Asha",
        executiveRole: "SALES_EXECUTIVE", type: "planned",
        orders: [{ id: "o1", code: "ORD-1" }], collections: [{ id: "c1", code: "COLL-1" }], marketIntelCount: "2",
      }],
      customer_missed_beat_rows: [{ date: new Date("2026-06-02T00:00:00Z"), at: new Date("2026-06-02T14:30:00Z"), executiveName: "Asha", newer: 0 }],
      customer_visits_by_role: [
        { bucket: "executive", total: 5, avgDuration: 20, productive: 3 },
        { bucket: "admin", total: 0, avgDuration: null, productive: 0 },
      ],
    });
    const out = await getCustomerVisits(sql, "cust-1", "2026-06-01", "2026-06-30", 1, 8);
    expect(out.summary).toEqual({ today: 1, week: 2, month: 3, all: 5 });
    expect(out.rows[0]).toMatchObject({ id: "v1", type: "planned", durationMinutes: 30 });
    expect(out.rows[0].orders[0]).toMatchObject({ code: "ORD-1" });
    expect(out.byRole.executive).toMatchObject({ total: 5, avgDurationMinutes: 20 });
    expect(out.byRole.admin.avgDurationMinutes).toBeNull();
    expect(out.missedRows[0]).toMatchObject({ date: "2026-06-02", executiveName: "Asha" });
  });
});
