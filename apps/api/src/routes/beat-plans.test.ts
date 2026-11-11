import { beforeEach, describe, expect, test, vi } from "vitest";
import { authHeaders, authTestEnv, installAuthFetchMock } from "../test/auth";

const SE_ID = "00000000-0000-4000-8000-000000000004";
const CUSTOMER_ID = "00000000-0000-4000-8000-000000000501";
const ORPHAN_CUSTOMER_ID = "00000000-0000-4000-8000-000000000599";

let lastAssign: unknown[] = [];

vi.mock("@neondatabase/serverless", () => ({
  neon: () => async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join(" ");
    if (query.includes("auth_app_profile")) {
      const role: Record<string, string> = {
        "neon-super-admin": "SUPER_ADMIN",
        "neon-manager": "MANAGER",
        "neon-se": "SALES_EXECUTIVE",
      };
      return [{ role: role[values[0] as string], userId: SE_ID }];
    }
    if (query.includes("beat_executives")) return [{ id: SE_ID, name: "Murali" }];
    if (query.includes("beat_template")) {
      return [
        { customerId: CUSTOMER_ID, customerCode: "CUST-0001", legalName: "Raj Motors", phone: "9", city: "Chennai", weekday: 2, sequenceNo: 1 },
        { customerId: ORPHAN_CUSTOMER_ID, customerCode: "CUST-0002", legalName: "Sri Auto", phone: null, city: null, weekday: null, sequenceNo: 0 },
      ];
    }
    if (query.includes("beat_assign_owner")) {
      return values.includes(ORPHAN_CUSTOMER_ID)
        ? [{ executiveId: null, role: null }]
        : [{ executiveId: SE_ID, role: "SALES_EXECUTIVE" }];
    }
    if (query.includes("assign_customer_to_beat_day")) {
      lastAssign = values;
      return [];
    }
    if (query.includes("unassign_customer_beat")) return [];
    return [];
  },
}));

const env = { DATABASE_URL: "postgresql://example.test/db", ...authTestEnv };
const headers = (subject: string) => ({ "Content-Type": "application/json", ...authHeaders(subject) });

describe("beat-plans admin routes", () => {
  beforeEach(() => {
    lastAssign = [];
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(installAuthFetchMock()));
  });

  test("SUPER_ADMIN lists sales executives", async () => {
    const { default: app } = await import("../index");
    const res = await app.request("/api/v1/beat-plans/executives", { headers: headers("neon-super-admin") }, env);
    expect(res.status).toBe(200);
    expect((await res.json()).data.executives).toEqual([{ id: SE_ID, name: "Murali" }]);
  });

  test("MANAGER gets an executive's template (customers with weekday or null)", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(`/api/v1/beat-plans?executiveId=${SE_ID}`, { headers: headers("neon-manager") }, env);
    expect(res.status).toBe(200);
    const rows = (await res.json()).data.customers;
    expect(rows[0]).toMatchObject({ legalName: "Raj Motors", weekday: 2 });
    expect(rows[1]).toMatchObject({ legalName: "Sri Auto", weekday: null });
  });

  test("template requires executiveId → 422", async () => {
    const { default: app } = await import("../index");
    const res = await app.request("/api/v1/beat-plans", { headers: headers("neon-super-admin") }, env);
    expect(res.status).toBe(422);
  });

  test("assign a customer to Wednesday (weekday 3)", async () => {
    const { default: app } = await import("../index");
    const res = await app.request("/api/v1/beat-plans/assign", {
      method: "PUT",
      headers: headers("neon-super-admin"),
      body: JSON.stringify({ customerId: CUSTOMER_ID, weekday: 3 }),
    }, env);
    expect(res.status).toBe(200);
    expect(lastAssign).toContain(3);
  });

  test("weekday out of range → 422", async () => {
    const { default: app } = await import("../index");
    const res = await app.request("/api/v1/beat-plans/assign", {
      method: "PUT",
      headers: headers("neon-super-admin"),
      body: JSON.stringify({ customerId: CUSTOMER_ID, weekday: 7 }),
    }, env);
    expect(res.status).toBe(422);
  });

  test("customer with no SE owner cannot be placed on a beat → 422", async () => {
    const { default: app } = await import("../index");
    const res = await app.request("/api/v1/beat-plans/assign", {
      method: "PUT",
      headers: headers("neon-super-admin"),
      body: JSON.stringify({ customerId: ORPHAN_CUSTOMER_ID, weekday: 2 }),
    }, env);
    expect(res.status).toBe(422);
  });

  test("SALES_EXECUTIVE is forbidden from the config routes → 403", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(`/api/v1/beat-plans?executiveId=${SE_ID}`, { headers: headers("neon-se") }, env);
    expect(res.status).toBe(403);
  });
});
