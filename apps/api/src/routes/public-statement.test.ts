import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, installAuth } from "../test/route-harness";

const TOKEN = "11111111-2222-4333-8444-555555555555";
const H = vi.hoisted(() => ({ responses: {} as Record<string, unknown[]> }));
vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => H.responses) };
});
beforeEach(() => {
  vi.resetModules();
  H.responses = {
    statement_customer_by_token: [{ id: "c1", legalName: "Ravi Motors", tradeName: "Ravi", city: "Hyd" }],
    statement_from_date: [{ from: "2026-01-01" }],
    statement_ageing: [{ b0_30: 0, b30_45: 0, b45_60: 0, b60_plus: 0, total: 0 }],
    statement_pending_verification: [{ pending: 0 }],
    ledger_range: [{ from: "2026-01-01", to: "2026-06-30", today: "2026-06-30" }],
    ledger_opening: [{ opening: 0 }],
    ledger_customer_opening: [],
    company_profile: [],
  };
  installAuth();
});

describe("GET /public/customer-statement/:token", () => {
  it("404s a malformed token (no DB hit)", async () => {
    const { default: app } = await import("../index");
    expect((await app.request("/api/v1/public/customer-statement/not-a-uuid", {}, ENV)).status).toBe(404);
  });
  it("404s an unknown token", async () => {
    H.responses = { statement_customer_by_token: [] };
    const { default: app } = await import("../index");
    expect((await app.request(`/api/v1/public/customer-statement/${TOKEN}`, {}, ENV)).status).toBe(404);
  });
  it("200s a valid token", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(`/api/v1/public/customer-statement/${TOKEN}`, {}, ENV);
    expect(res.status).toBe(200);
    expect((await res.json()).data.customer.name).toBe("Ravi");
  });
});
