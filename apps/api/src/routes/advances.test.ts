import { beforeEach, describe, expect, test, vi } from "vitest";
import { authHeaders, authTestEnv, installAuthFetchMock } from "../test/auth";

const SUPER_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const MANAGER_ID = "00000000-0000-4000-8000-000000000002";
const ACCOUNTANT_ID = "00000000-0000-4000-8000-000000000003";
const SE_ID = "00000000-0000-4000-8000-000000000004";
const AID = "00000000-0000-4000-8000-000000000d01";
const ACTIVE_ID = "00000000-0000-4000-8000-000000000d02";
const ENT = "00000000-0000-4000-8000-0000000000e1";

function advRow(id: unknown) {
  return {
    id, userId: SE_ID, userName: "Priya", amount: "10000", source: "request",
    status: id === ACTIVE_ID ? "active" : "requested", recoveryPlan: null, installmentAmount: null,
    outstanding: "0", reason: "medical", rejectReason: null, approvedAt: null, createdAt: "2026-11-28T04:00:00.000Z",
  };
}

vi.mock("@neondatabase/serverless", () => {
  const handler = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const q = strings.join(" ");
    if (q.includes("auth_app_profile")) {
      const role: Record<string, string> = { "neon-super-admin": "SUPER_ADMIN", "neon-manager": "MANAGER", "neon-accountant": "ACCOUNTANT", "neon-se": "SALES_EXECUTIVE" };
      const uid: Record<string, string> = { "neon-super-admin": SUPER_ADMIN_ID, "neon-manager": MANAGER_ID, "neon-accountant": ACCOUNTANT_ID, "neon-se": SE_ID };
      const s = values[0] as string;
      return [{ role: role[s], userId: uid[s] ?? SUPER_ADMIN_ID, enterpriseId: ENT }];
    }
    if (q.includes("role_permission_overrides")) return [];
    if (q.includes("advance_balances")) return [{ userId: SE_ID, userName: "Priya", outstanding: "8000" }];
    if (q.includes("request_advance") || q.includes("record_advance")) return [{ id: AID }];
    return [];
  };
  handler.query = async (text: string, params: unknown[]) => {
    if (text.includes("my_advances")) return [advRow(AID)];
    if (text.includes("list_advances")) return [advRow(AID)];
    if (text.includes("get_advance")) return [advRow(params[0])];
    return [];
  };
  return { neon: () => handler };
});

const env = { DATABASE_URL: "postgresql://example.test/db", ...authTestEnv };
const jh = (s: string) => ({ "Content-Type": "application/json", ...authHeaders(s) });

describe("advances routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(installAuthFetchMock()));
  });

  test("SE requests an advance; office cannot request", async () => {
    const { default: app } = await import("../index");
    const ok = await app.request("/api/v1/advances", { method: "POST", headers: jh("neon-se"), body: JSON.stringify({ amount: 10000, reason: "medical" }) }, env);
    expect(ok.status).toBe(201);
    const no = await app.request("/api/v1/advances", { method: "POST", headers: jh("neon-manager"), body: JSON.stringify({ amount: 10000 }) }, env);
    expect(no.status).toBe(403);
    const noAmount = await app.request("/api/v1/advances", { method: "POST", headers: jh("neon-se"), body: "{}" }, env);
    expect(noAmount.status).toBe(422); // amount defaults to 0 → rejected
  });

  test("SE sees their own advances; office sees balances + queue; cross-role 403", async () => {
    const { default: app } = await import("../index");
    expect((await app.request("/api/v1/advances/mine", { headers: authHeaders("neon-se") }, env)).status).toBe(200);
    expect((await app.request("/api/v1/advances/mine", { headers: authHeaders("neon-manager") }, env)).status).toBe(403);
    expect((await app.request("/api/v1/advances/balances", { headers: authHeaders("neon-manager") }, env)).status).toBe(200);
    expect((await app.request("/api/v1/advances/balances", { headers: authHeaders("neon-se") }, env)).status).toBe(403);
    expect((await app.request("/api/v1/advances?status=active", { headers: authHeaders("neon-accountant") }, env)).status).toBe(200);
    expect((await app.request("/api/v1/advances", { headers: authHeaders("neon-manager") }, env)).status).toBe(200); // default status
    expect((await app.request("/api/v1/advances", { headers: authHeaders("neon-se") }, env)).status).toBe(403);
  });

  test("office records a direct advance; SE cannot", async () => {
    const { default: app } = await import("../index");
    const ok = await app.request("/api/v1/advances/record", { method: "POST", headers: jh("neon-manager"), body: JSON.stringify({ userId: SE_ID, amount: 10000, recoveryPlan: "full_next" }) }, env);
    expect(ok.status).toBe(201);
    const no = await app.request("/api/v1/advances/record", { method: "POST", headers: jh("neon-se"), body: JSON.stringify({ userId: SE_ID, amount: 1, recoveryPlan: "full_next" }) }, env);
    expect(no.status).toBe(403);
    const noAmount = await app.request("/api/v1/advances/record", { method: "POST", headers: jh("neon-manager"), body: JSON.stringify({ userId: SE_ID, recoveryPlan: "full_next" }) }, env);
    expect(noAmount.status).toBe(422); // amount defaults to 0 → rejected
  });

  test("office approves a request; SE cannot; an active advance is 409", async () => {
    const { default: app } = await import("../index");
    const ok = await app.request(`/api/v1/advances/${AID}/approve`, { method: "POST", headers: jh("neon-manager"), body: JSON.stringify({ recoveryPlan: "installment", installmentAmount: 2000 }) }, env);
    expect(ok.status).toBe(200);
    const no = await app.request(`/api/v1/advances/${AID}/approve`, { method: "POST", headers: jh("neon-se"), body: JSON.stringify({ recoveryPlan: "full_next" }) }, env);
    expect(no.status).toBe(403);
    const conflict = await app.request(`/api/v1/advances/${ACTIVE_ID}/approve`, { method: "POST", headers: jh("neon-super-admin"), body: JSON.stringify({ recoveryPlan: "full_next" }) }, env);
    expect(conflict.status).toBe(409);
  });

  test("office rejects a request with a reason; a blank reason is 422", async () => {
    const { default: app } = await import("../index");
    const ok = await app.request(`/api/v1/advances/${AID}/reject`, { method: "POST", headers: jh("neon-manager"), body: JSON.stringify({ reason: "no budget" }) }, env);
    expect(ok.status).toBe(200);
    const bad = await app.request(`/api/v1/advances/${AID}/reject`, { method: "POST", headers: jh("neon-manager"), body: "{}" }, env);
    expect(bad.status).toBe(422);
  });
});
