import { describe, expect, it } from "vitest";
import { getAccountantDashboard, getManagerDashboard, getSuperAdminDashboard } from "./dashboard";
import { makeSql } from "../test/sql-mock";

const CTX = { userId: "u1" };

describe("role dashboards", () => {
  it("super-admin: null total → 0 and maps executive rows", async () => {
    const sql = makeSql({
      dashboard_totals: [{ pendingCollections: null }],
      executive_performance: [{ executiveId: "se-1", executiveName: "Asha", gpsStatus: "active" }],
    });
    const out = await getSuperAdminDashboard(sql, CTX);
    expect(out.metrics.pendingCollections).toBe(0);
    expect(out.executivePerformance[0]).toMatchObject({ executiveId: "se-1", gpsStatus: "active" });
  });
  it("manager + accountant dashboards map their totals", async () => {
    expect((await getManagerDashboard(makeSql({ manager_dashboard_totals: [{ activeGpsSessions: "2" }] }), CTX)).metrics.activeGpsSessions).toBe(2);
    const acc = await getAccountantDashboard(makeSql({ accountant_dashboard_totals: [{ pendingVerification: "1", approvedCollections: "3", rejectedCollections: "0", totalCollected: "9000" }] }), CTX);
    expect(acc.metrics).toMatchObject({ pendingVerification: 1, totalCollected: 9000 });
  });
});
