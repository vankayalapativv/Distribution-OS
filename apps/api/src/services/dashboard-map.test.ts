import { describe, expect, it } from "vitest";
import { getDashboardMapActivity, getDashboardMapCustomers } from "./dashboard-map";
import { makeSql } from "../test/sql-mock";

describe("getDashboardMapCustomers", () => {
  it("maps customers and assigns the dues bucket by age (incl. the null/clear case)", async () => {
    const base = {
      name: "Ravi Motors",
      code: "C1",
      city: "Hyderabad",
      lat: "17.4",
      lng: "78.4",
      executiveId: "se1",
      executiveName: "Asha",
      outstanding: "4000",
      lastOrderDays: "3",
      lastCollectionDays: null,
      active: true,
    };
    const sql = makeSql({
      dashboard_map_customers: [
        { ...base, id: "c0", ageDays: null, outstanding: 0 }, // clear → null bucket
        { ...base, id: "c1", ageDays: 30 }, // 0_30
        { ...base, id: "c2", ageDays: 45 }, // 30_45
        { ...base, id: "c3", ageDays: 60 }, // 45_60
        { ...base, id: "c4", ageDays: 61, active: false }, // 60_plus
      ],
    });
    const { customers, bands } = await getDashboardMapCustomers(sql);
    // No dues_bands_load mock → the default 4 bands, keyed by ordinal ("0".."3").
    expect(customers.map((r) => r.bucket)).toEqual([null, "0", "1", "2", "3"]);
    expect(customers[0]).toMatchObject({ id: "c0", lat: 17.4, lng: 78.4, lastCollectionDays: null });
    expect(customers[4].active).toBe(false);
    expect(bands).toHaveLength(4);
  });

  it("coerces blank city/executive to null", async () => {
    const sql = makeSql({
      dashboard_map_customers: [
        { id: "c1", name: "X", code: "C", city: "", lat: 1, lng: 2, executiveId: "", executiveName: "", outstanding: 0, ageDays: null, lastOrderDays: null, lastCollectionDays: null, active: false },
      ],
    });
    const { customers } = await getDashboardMapCustomers(sql);
    expect(customers[0]).toMatchObject({ city: null, executiveId: null, executiveName: null, lastOrderDays: null });
  });
});

describe("getDashboardMapActivity", () => {
  it("maps positions, check-ins (planned/unplanned) and route point arrays", async () => {
    const sql = makeSql({
      dashboard_map_positions: [
        { userId: "se1", name: "Asha", lat: "17.4", lng: "78.4", recordedAt: new Date("2026-06-01T05:00:00Z"), live: true },
      ],
      dashboard_map_checkins: [
        { visitId: "v1", customerId: "c1", customerName: "Ravi", lat: 1, lng: 2, executiveName: "Asha", at: new Date("2026-06-01T05:10:00Z"), type: "planned" },
        { visitId: "v2", customerId: "c2", customerName: "Kumar", lat: 3, lng: 4, executiveName: null, at: null, type: "adhoc" },
      ],
      dashboard_map_routes: [
        { userId: "se1", name: "Asha", points: [{ lat: 1, lng: 2 }, { lat: "3", lng: "4" }] },
        { userId: "se2", name: "Ravi", points: null }, // non-array → []
      ],
    });
    const act = await getDashboardMapActivity(sql);
    expect(act.positions[0]).toMatchObject({ userId: "se1", lat: 17.4, live: true });
    expect(act.checkins[0].type).toBe("planned");
    expect(act.checkins[1]).toMatchObject({ type: "unplanned", executiveName: null, at: null });
    expect(act.routes[0].points).toEqual([{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }]);
    expect(act.routes[1].points).toEqual([]);
  });
});
