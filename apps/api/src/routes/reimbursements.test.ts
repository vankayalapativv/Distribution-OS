import { beforeEach, describe, expect, test, vi } from "vitest";
import { authHeaders, authTestEnv, installAuthFetchMock } from "../test/auth";

const SUPER_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const MANAGER_ID = "00000000-0000-4000-8000-000000000002";
const ACCOUNTANT_ID = "00000000-0000-4000-8000-000000000003";
const SE_ID = "00000000-0000-4000-8000-000000000004";
const PID = "00000000-0000-4000-8000-000000000c01";
const PAID_ID = "00000000-0000-4000-8000-000000000c02";
const ENT = "00000000-0000-4000-8000-0000000000e1";

function payRow(id: unknown) {
  return {
    id, userId: SE_ID, userName: "Priya", amount: "450",
    status: id === PAID_ID ? "paid" : "owed", categoryName: "Fuel", code: "EXP-7",
    date: "2026-11-28", paymentMode: null, paidAt: null, createdAt: "2026-11-28T04:00:00.000Z",
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
    if (q.includes("reimbursement_balances")) return [{ userId: SE_ID, userName: "Priya", owed: "450", owedCount: 1 }];
    return [];
  };
  handler.query = async (text: string, params: unknown[]) => {
    if (text.includes("my_reimbursements")) return [payRow(PID)];
    if (text.includes("list_payables")) return [payRow(PID)];
    if (text.includes("get_payable")) return [payRow(params[0])];
    return [];
  };
  return { neon: () => handler };
});

const env = { DATABASE_URL: "postgresql://example.test/db", ...authTestEnv };
const jsonHeaders = (s: string) => ({ "Content-Type": "application/json", ...authHeaders(s) });

describe("reimbursements routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(installAuthFetchMock()));
  });

  test("SE sees their own reimbursements; office is forbidden on /mine", async () => {
    const { default: app } = await import("../index");
    const ok = await app.request("/api/v1/reimbursements/mine", { headers: authHeaders("neon-se") }, env);
    expect(ok.status).toBe(200);
    expect((await ok.json()).data).toMatchObject({ owedTotal: 450 });
    const no = await app.request("/api/v1/reimbursements/mine", { headers: authHeaders("neon-manager") }, env);
    expect(no.status).toBe(403);
  });

  test("office sees per-person balances; SE is forbidden", async () => {
    const { default: app } = await import("../index");
    const ok = await app.request("/api/v1/reimbursements/balances", { headers: authHeaders("neon-manager") }, env);
    expect(ok.status).toBe(200);
    expect((await ok.json()).data[0]).toMatchObject({ owed: 450 });
    const no = await app.request("/api/v1/reimbursements/balances", { headers: authHeaders("neon-se") }, env);
    expect(no.status).toBe(403);
  });

  test("office lists the settle queue; SE is forbidden", async () => {
    const { default: app } = await import("../index");
    const ok = await app.request("/api/v1/reimbursements?status=owed", { headers: authHeaders("neon-accountant") }, env);
    expect(ok.status).toBe(200);
    expect((await ok.json()).data).toHaveLength(1);
    const dflt = await app.request("/api/v1/reimbursements", { headers: authHeaders("neon-manager") }, env);
    expect(dflt.status).toBe(200); // no ?status → defaults to owed
    const no = await app.request("/api/v1/reimbursements", { headers: authHeaders("neon-se") }, env);
    expect(no.status).toBe(403);
  });

  test("manager marks a payable paid; SE is forbidden; a paid one is 409", async () => {
    const { default: app } = await import("../index");
    const ok = await app.request(`/api/v1/reimbursements/${PID}/pay`, { method: "POST", headers: jsonHeaders("neon-manager"), body: JSON.stringify({ paymentMode: "upi" }) }, env);
    expect(ok.status).toBe(200);
    const no = await app.request(`/api/v1/reimbursements/${PID}/pay`, { method: "POST", headers: jsonHeaders("neon-se"), body: "{}" }, env);
    expect(no.status).toBe(403);
    const conflict = await app.request(`/api/v1/reimbursements/${PAID_ID}/pay`, { method: "POST", headers: jsonHeaders("neon-super-admin"), body: "{}" }, env);
    expect(conflict.status).toBe(409);
    // A malformed body is tolerated (defaults to no payment mode).
    const bad = await app.request(`/api/v1/reimbursements/${PID}/pay`, { method: "POST", headers: jsonHeaders("neon-manager"), body: "{bad" }, env);
    expect(bad.status).toBe(200);
  });
});
