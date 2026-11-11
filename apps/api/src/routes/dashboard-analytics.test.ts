import { beforeEach, describe, expect, test, vi } from "vitest";
import { authHeaders, authTestEnv, installAuthFetchMock } from "../test/auth";

const SUPER_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const MANAGER_ID = "00000000-0000-4000-8000-000000000002";
const ACCOUNTANT_ID = "00000000-0000-4000-8000-000000000003";

let lastCustomerQuery = "";

const env = { DATABASE_URL: "postgresql://example.test/db", ...authTestEnv };

vi.mock("@neondatabase/serverless", () => ({
  neon: () => async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join(" ");

    if (query.includes("auth_app_profile")) {
      const bySubject: Record<string, { role: string; userId: string , enterpriseId: "00000000-0000-4000-8000-0000000000e1"}> = {
        "neon-super-admin": { role: "SUPER_ADMIN", userId: SUPER_ADMIN_ID , enterpriseId: "00000000-0000-4000-8000-0000000000e1"},
        "neon-manager": { role: "MANAGER", userId: MANAGER_ID , enterpriseId: "00000000-0000-4000-8000-0000000000e1"},
        "neon-accountant": { role: "ACCOUNTANT", userId: ACCOUNTANT_ID , enterpriseId: "00000000-0000-4000-8000-0000000000e1"},
      };
      return [bySubject[values[0] as string] ?? bySubject["neon-super-admin"]];
    }

    // Oils: two SKUs of the same product in Cars (different pack sizes) —
    // the case that proves product+pack is the SKU grain.
    if (query.includes("analytics_oil_segment_totals")) {
      return [
        { segment: "Car", litres: "532", quantity: "61", orders: 4, customers: 4 },
        { segment: "3W", litres: "152.5", quantity: "42", orders: 1, customers: 1 },
      ];
    }
    if (query.includes("analytics_oils")) {
      return [
        {
          segment: "Car",
          productId: "p1",
          productName: "Titan Formula 5W-30 SP",
          packSizeLitres: "3.50",
          litres: "42",
          quantity: "12",
          orders: 2,
          customers: 2,
        },
        {
          segment: "Car",
          productId: "p1",
          productName: "Titan Formula 5W-30 SP",
          packSizeLitres: "1.00",
          litres: "20",
          quantity: "20",
          orders: 1,
          customers: 1,
        },
        {
          segment: "3W",
          productId: "p2",
          productName: "TITAN UNIVERSAL CH-4 15W-40",
          packSizeLitres: "3.00",
          litres: "120",
          quantity: "40",
          orders: 1,
          customers: 1,
        },
      ];
    }

    if (query.includes("analytics_customers")) {
      lastCustomerQuery = query;
      return [
        {
          customerId: "c1",
          customerName: "MOHD Salauddin Garage",
          customerCode: "CUST-0003",
          salesExecutive: "Vishnu vardhan",
          litres: "415",
          orders: 1,
          collected: "20000",
          pendingCollections: 0,
          lastOrderDate: "2026-07-17",
        },
        {
          customerId: "c2",
          customerName: "Dormant Traders",
          customerCode: "CUST-0099",
          salesExecutive: null,
          litres: "0",
          orders: 0,
          collected: "0",
          pendingCollections: 0,
          lastOrderDate: null,
        },
      ];
    }

    return [];
  },
}));

beforeEach(() => {
  lastCustomerQuery = "";
  vi.resetModules();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(installAuthFetchMock()));
});

describe("GET /dashboard/analytics/oils", () => {
  test("groups by segment with product+pack SKUs nested", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(
      "/api/v1/dashboard/analytics/oils?from=2026-07-01&to=2026-07-20",
      { headers: authHeaders("neon-super-admin") },
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { segments: { segment: string; litres: number; skus: unknown[] }[]; totalLitres: number };
    };

    const cars = body.data.segments.find((s) => s.segment === "Car")!;
    expect(cars.litres).toBe(532);
    // Same product, two pack sizes = two distinct SKU rows.
    expect(cars.skus).toHaveLength(2);
    expect(cars.skus[0]).toMatchObject({
      productName: "Titan Formula 5W-30 SP",
      packSizeLitres: 3.5,
      litres: 42,
    });
    expect(cars.skus[1]).toMatchObject({ packSizeLitres: 1, litres: 20 });

    expect(body.data.totalLitres).toBe(684.5);
  });

  test("segments with no sales still appear as zero rows", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(
      "/api/v1/dashboard/analytics/oils",
      { headers: authHeaders("neon-manager") },
      env,
    );
    const body = (await res.json()) as {
      data: { segments: { segment: string; litres: number; skus: unknown[] }[] };
    };
    const names = body.data.segments.map((s) => s.segment);
    for (const s of ["Car", "2W", "3W", "Commercial", "Agri", "Gear Oil"]) {
      expect(names).toContain(s);
    }
    const agri = body.data.segments.find((s) => s.segment === "Agri")!;
    expect(agri.litres).toBe(0);
    expect(agri.skus).toHaveLength(0);
  });

  test("ACCOUNTANT is forbidden", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(
      "/api/v1/dashboard/analytics/oils",
      { headers: authHeaders("neon-accountant") },
      env,
    );
    expect(res.status).toBe(403);
  });

  test("invalid range → 422", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(
      "/api/v1/dashboard/analytics/oils?from=2026-07-20&to=2026-07-01",
      { headers: authHeaders("neon-super-admin") },
      env,
    );
    expect(res.status).toBe(422);
  });
});

describe("GET /dashboard/analytics/customers", () => {
  test("active-only by default, with the owning sales executive", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(
      "/api/v1/dashboard/analytics/customers?from=2026-07-01&to=2026-07-20",
      { headers: authHeaders("neon-manager") },
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        customers: { customerName: string; salesExecutive: string | null }[];
        activeCount: number;
        totalCount: number;
      };
    };
    expect(body.data.customers).toHaveLength(1);
    expect(body.data.customers[0]).toMatchObject({
      customerName: "MOHD Salauddin Garage",
      salesExecutive: "Vishnu vardhan",
      litres: 415,
      collected: 20000,
    });
    expect(body.data.activeCount).toBe(1);
    expect(body.data.totalCount).toBe(2);
  });

  test("includeInactive=true returns dormant customers too", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(
      "/api/v1/dashboard/analytics/customers?includeInactive=true",
      { headers: authHeaders("neon-super-admin") },
      env,
    );
    const body = (await res.json()) as {
      data: { customers: { customerName: string; lastOrderDate: string | null; salesExecutive: string | null }[] };
    };
    expect(body.data.customers).toHaveLength(2);
    const dormant = body.data.customers.find((c) => c.customerName === "Dormant Traders")!;
    expect(dormant.lastOrderDate).toBeNull();
    expect(dormant.salesExecutive).toBeNull();
  });

  test("no dues/outstanding field is exposed (invoices don't exist yet)", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(
      "/api/v1/dashboard/analytics/customers",
      { headers: authHeaders("neon-super-admin") },
      env,
    );
    const body = (await res.json()) as { data: { customers: Record<string, unknown>[] } };
    const row = body.data.customers[0];
    expect(row).not.toHaveProperty("dues");
    expect(row).not.toHaveProperty("outstanding");
    expect(row).toHaveProperty("collected");
    expect(row).toHaveProperty("pendingCollections");
  });
});
