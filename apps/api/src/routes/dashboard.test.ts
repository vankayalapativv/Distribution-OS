import { beforeEach, describe, expect, test, vi } from "vitest";
import { authHeaders, authTestEnv, installAuthFetchMock } from "../test/auth";

const dashboardRows = {
  totals: [
    {
      activeExecutives: 3,
      completedVisits: 18,
      productiveVisits: 12,
      salesValue: "185000.00",
      collections: "74000.00",
      pendingCollections: 5,
      overdueCustomers: 4,
    },
  ],
  executives: [
    {
      executiveId: "11111111-1111-4111-8111-111111111111",
      executiveName: "Anika Sharma",
      completedVisits: 8,
      productiveVisits: 6,
      salesValue: "92000.00",
      collections: "36000.00",
      gpsStatus: "active",
    },
  ],
  collectionRisk: [
    {
      bucket: "31-60",
      customerCount: 3,
      outstandingAmount: "42000.00",
    },
  ],
  managerTotals: [
    {
      teamExecutives: 2,
      completedVisits: 14,
      productiveVisits: 9,
      salesValue: "131000.00",
      collections: "51000.00",
      activeGpsSessions: 1,
    },
  ],
  accountantTotals: [
    {
      pendingVerification: 7,
      approvedCollections: 18,
      rejectedCollections: 2,
      totalCollected: "86000.00",
      outstandingAmount: "145000.00",
      overdueCustomers: 6,
    },
  ],
};

vi.mock("@neondatabase/serverless", () => ({
  neon: () => async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join(" ");

    if (query.includes("auth_app_profile")) {
      const subject = values[0];
      const roleBySubject = {
        "neon-super-admin": "SUPER_ADMIN",
        "neon-manager": "MANAGER",
        "neon-accountant": "ACCOUNTANT",
      } as const;

      return [
        {
          role: roleBySubject[subject as keyof typeof roleBySubject],
          userId: "00000000-0000-4000-8000-000000000001", enterpriseId: "00000000-0000-4000-8000-0000000000e1",
        },
      ];
    }

    if (query.includes("manager_dashboard_totals")) {
      return dashboardRows.managerTotals;
    }

    if (query.includes("accountant_dashboard_totals")) {
      return dashboardRows.accountantTotals;
    }

    if (query.includes("dashboard_totals")) {
      return dashboardRows.totals;
    }

    if (query.includes("executive_performance")) {
      return dashboardRows.executives;
    }

    if (query.includes("collection_risk")) {
      return dashboardRows.collectionRisk;
    }

    return [];
  },
}));

describe("dashboard routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(installAuthFetchMock()),
    );
  });

  test("manager can see team execution dashboard", async () => {
    const { default: app } = await import("../index");

    const response = await app.request(
      "/api/v1/dashboard/manager",
      {
        headers: authHeaders("neon-manager"),
      },
      {
        DATABASE_URL: "postgresql://example.test/db",
        ...authTestEnv,
      },
    );

    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body).toMatchObject({
      success: true,
      data: {
        role: "MANAGER",
        metrics: {
          teamExecutives: 0,
          completedVisits: 0,
          productiveVisits: 0,
          salesValue: 0,
          collections: 0,
          activeGpsSessions: 1,
        },
      },
    });
  });

  test("accountant can see collection verification dashboard", async () => {
    const { default: app } = await import("../index");

    const response = await app.request(
      "/api/v1/dashboard/accountant",
      {
        headers: authHeaders("neon-accountant"),
      },
      {
        DATABASE_URL: "postgresql://example.test/db",
        ...authTestEnv,
      },
    );

    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body).toMatchObject({
      success: true,
      data: {
        role: "ACCOUNTANT",
        metrics: {
          pendingVerification: 7,
          approvedCollections: 18,
          rejectedCollections: 2,
          totalCollected: 86000,
          outstandingAmount: 0,
          overdueCustomers: 0,
        },
      },
    });
  });

  test("rejects the old placeholder auth headers", async () => {
    const { default: app } = await import("../index");

    const response = await app.request(
      "/api/v1/dashboard/manager",
      {
        headers: {
          "X-Distribution-OS-User-Id": "00000000-0000-4000-8000-000000000001",
          "X-Distribution-OS-Organization-Id": "00000000-0000-4000-8000-000000000100",
          "X-Distribution-OS-Role": "SUPER_ADMIN",
        },
      },
      {
        DATABASE_URL: "postgresql://example.test/db",
        ...authTestEnv,
      },
    );

    expect(response.status).toBe(401);
  });
});
