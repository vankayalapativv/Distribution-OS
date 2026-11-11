import { describe, expect, it } from "vitest";
import { humanizeMetricLabel, mapDashboardData, type ApiDashboard } from "./dashboard-transform";

describe("humanizeMetricLabel", () => {
  it("spaces camelCase and capitalises the first letter", () => {
    expect(humanizeMetricLabel("salesValue")).toBe("Sales Value");
    expect(humanizeMetricLabel("productiveVisits")).toBe("Productive Visits");
  });

  it("capitalises a single lowercase word", () => {
    expect(humanizeMetricLabel("collections")).toBe("Collections");
  });
});

describe("mapDashboardData", () => {
  it("humanises metric labels and stringifies values", () => {
    const data: ApiDashboard = { metrics: { salesValue: 185000, collections: "74000" } };
    const result = mapDashboardData(data);
    expect(result.metrics).toEqual([
      { label: "Sales Value", value: "185000" },
      { label: "Collections", value: "74000" },
    ]);
    // No executivePerformance in the payload → empty list (the `?? []` branch).
    expect(result.executivePerformance).toEqual([]);
  });

  it("maps executive rows, passing through every provided field", () => {
    const data: ApiDashboard = {
      metrics: {},
      executivePerformance: [
        {
          executiveName: "Anika Sharma",
          completedVisits: 8,
          productiveVisits: 6,
          salesValue: 92000,
          collections: 36000,
          gpsStatus: "active",
        },
      ],
    };
    expect(mapDashboardData(data).executivePerformance).toEqual([
      {
        name: "Anika Sharma",
        visits: 8,
        productiveVisits: 6,
        salesValue: "92000",
        collections: "36000",
        gpsStatus: "active",
      },
    ]);
  });

  it("falls back to defaults for every missing executive field", () => {
    const data: ApiDashboard = { metrics: {}, executivePerformance: [{}] };
    expect(mapDashboardData(data).executivePerformance).toEqual([
      {
        name: "Unknown Executive",
        visits: 0,
        productiveVisits: 0,
        salesValue: "0",
        collections: "0",
        gpsStatus: "unknown",
      },
    ]);
  });
});
