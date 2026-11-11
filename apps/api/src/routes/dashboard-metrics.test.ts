import { beforeEach, describe, expect, test, vi } from "vitest";
import { authHeaders, authTestEnv, installAuthFetchMock } from "../test/auth";

const SUPER_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const MANAGER_ID = "00000000-0000-4000-8000-000000000002";
const ACCOUNTANT_ID = "00000000-0000-4000-8000-000000000003";
const AGENT_ID = "00000000-0000-4000-8000-000000000101";

let queryLog: string[] = [];

const env = {
  DATABASE_URL: "postgresql://example.test/db",
  ...authTestEnv,
};

vi.mock("@neondatabase/serverless", () => ({
  neon: () => async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join(" ");

    if (query.includes("auth_app_profile")) {
      const bySubject: Record<string, { role: string; userId: string }> = {
        "neon-super-admin": { role: "SUPER_ADMIN", userId: SUPER_ADMIN_ID },
        "neon-manager": { role: "MANAGER", userId: MANAGER_ID },
        "neon-accountant": { role: "ACCOUNTANT", userId: ACCOUNTANT_ID },
      };
      const subject = values[0] as string;
      return [bySubject[subject] ?? bySubject["neon-super-admin"]];
    }

    const tag = query.match(/\/\*\s*([a-z0-9_]+)\s*\*\//i);
    if (tag) queryLog.push(tag[1]);

    if (query.includes("metrics_executives")) return [{ total: 6, live: 2 }];
    if (query.includes("metrics_visits")) return [{ visits: 14, productiveVisits: 9 }];
    // Sold Oil is now delivered-based (invoices on a delivery run, net of returns).
    if (query.includes("metrics_delivered")) return [{ litres: "431.0", deliveries: 6 }];
    if (query.includes("metrics_ordered")) return [{ litres: "512.0", orders: 8 }];
    if (query.includes("metrics_collections"))
      return [{ total: "48500", verified: "12000", pendingCount: 3, count: 7 }];

    if (query.includes("agents_collections"))
      return [
        {
          agentId: AGENT_ID,
          agentName: "Bhaskar",
          amount: "28500",
          verified: "8000",
          collections: 4,
          customers: 3,
        },
      ];
    if (query.includes("agents_visits"))
      return [
        { agentId: AGENT_ID, agentName: "Bhaskar", visits: 8, productiveVisits: 5, customers: 6 },
      ];
    if (query.includes("agents_sales"))
      return [
        {
          agentId: AGENT_ID,
          agentName: "Bhaskar",
          litres: "210",
          orders: 3,
          customers: 3,
        },
      ];
    if (query.includes("agents_executives"))
      return [
        {
          agentId: AGENT_ID,
          agentName: "Bhaskar",
          sessionStartedAt: "2026-07-18T03:58:00Z",
          lastPingAt: "2026-07-18T09:00:00Z",
          live: true,
          visits: 8,
        },
      ];

    if (query.includes("agent_customer_collections"))
      return [
        {
          customerName: "Janatha Garage",
          collectionCode: "COLL-0001",
          date: "2026-07-18",
          createdAt: "2026-07-18T06:12:00Z",
          amount: "15000",
          paymentMode: "cash",
          status: "pending",
        },
      ];
    if (query.includes("agent_customer_visits"))
      return [
        {
          customerName: "Janatha Garage",
          date: "2026-07-18",
          checkInAt: "2026-07-18T06:00:00Z",
          checkOutAt: null,
          productive: true,
        },
      ];
    if (query.includes("agent_customer_delivered"))
      return [
        {
          customerName: "Janatha Garage",
          orderCode: "INV-0007",
          date: "2026-07-18",
          createdAt: "2026-07-18T06:30:00Z",
          returnedLitres: "0",
          litres: "45",
        },
      ];
    if (query.includes("agent_customer_orders"))
      return [
        {
          customerName: "Janatha Garage",
          orderCode: "ORD-0021",
          date: "2026-07-18",
          createdAt: "2026-07-18T06:30:00Z",
          litres: "45",
          oilLines: 3,
        },
      ];
    if (query.includes("agent_day_timeline"))
      return [
        {
          date: "2026-07-18",
          startedAt: "2026-07-18T03:58:00Z",
          endedAt: null,
          lastPingAt: "2026-07-18T09:00:00Z",
          visits: 8,
        },
      ];

    return [];
  },
}));

beforeEach(() => {
  queryLog = [];
  vi.resetModules();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(installAuthFetchMock()));
});

describe("GET /dashboard/metrics", () => {
  test("SUPER_ADMIN gets the live metrics", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(
      "/api/v1/dashboard/metrics?from=2026-07-18&to=2026-07-18",
      { headers: authHeaders("neon-super-admin") },
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(body.data.activeExecutives).toEqual({ live: 2, total: 6 });
    expect(body.data.visits).toBe(14);
    expect(body.data.productiveVisits).toBe(9);
    expect(body.data.sales).toEqual({ litres: 431, orders: 6 });
    expect(body.data.collections).toEqual({
      total: 48500,
      verified: 12000,
      pendingCount: 3,
      count: 7,
    });
  });

  test("MANAGER can read metrics", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(
      "/api/v1/dashboard/metrics",
      { headers: authHeaders("neon-manager") },
      env,
    );
    expect(res.status).toBe(200);
  });

  test("ACCOUNTANT is forbidden", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(
      "/api/v1/dashboard/metrics",
      { headers: authHeaders("neon-accountant") },
      env,
    );
    expect(res.status).toBe(403);
  });

  test("invalid range → 422", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(
      "/api/v1/dashboard/metrics?from=2026-07-19&to=2026-07-18",
      { headers: authHeaders("neon-super-admin") },
      env,
    );
    expect(res.status).toBe(422);
  });
});

describe("GET /dashboard/metrics/:metric/agents", () => {
  test("collections agents include amounts and verified", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(
      "/api/v1/dashboard/metrics/collections/agents?from=2026-07-18&to=2026-07-18",
      { headers: authHeaders("neon-super-admin") },
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { agents: Record<string, unknown>[] } };
    expect(body.data.agents[0]).toMatchObject({
      agentName: "Bhaskar",
      amount: 28500,
      verified: 8000,
      collections: 4,
      customers: 3,
    });
  });

  test("executives agents include live status and last ping", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(
      "/api/v1/dashboard/metrics/executives/agents",
      { headers: authHeaders("neon-manager") },
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { agents: Record<string, unknown>[] } };
    expect(body.data.agents[0]).toMatchObject({ agentName: "Bhaskar", live: true, visits: 8 });
  });

  test("unknown metric → 422", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(
      "/api/v1/dashboard/metrics/nonsense/agents",
      { headers: authHeaders("neon-super-admin") },
      env,
    );
    expect(res.status).toBe(422);
  });
});

describe("GET /dashboard/metrics/:metric/agents/:agentId/customers", () => {
  test("collections drill-down returns customer payments with status", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(
      `/api/v1/dashboard/metrics/collections/agents/${AGENT_ID}/customers?from=2026-07-18&to=2026-07-18`,
      { headers: authHeaders("neon-super-admin") },
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { rows: Record<string, unknown>[] } };
    expect(body.data.rows[0]).toMatchObject({
      customerName: "Janatha Garage",
      amount: 15000,
      paymentMode: "cash",
      status: "pending",
    });
  });

  test("litres (Sold Oil) drill-down returns delivered-invoice litres", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(
      `/api/v1/dashboard/metrics/litres/agents/${AGENT_ID}/customers`,
      { headers: authHeaders("neon-manager") },
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { rows: Record<string, unknown>[] } };
    expect(body.data.rows[0]).toMatchObject({ orderCode: "INV-0007", litres: 45 });
    expect(queryLog).toContain("agent_customer_delivered");
  });

  test("executives drill-down returns the day timeline", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(
      `/api/v1/dashboard/metrics/executives/agents/${AGENT_ID}/customers`,
      { headers: authHeaders("neon-super-admin") },
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { rows: Record<string, unknown>[] } };
    expect(body.data.rows[0]).toMatchObject({ date: "2026-07-18", visits: 8 });
  });
});
