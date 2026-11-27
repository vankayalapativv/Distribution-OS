import { beforeEach, describe, expect, test, vi } from "vitest";
import { authHeaders, authTestEnv, installAuthFetchMock } from "../test/auth";

const SUPER_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const MANAGER_ID = "00000000-0000-4000-8000-000000000002";
const ACCOUNTANT_ID = "00000000-0000-4000-8000-000000000003";
const SE_ID = "00000000-0000-4000-8000-000000000004";
const ENT = "00000000-0000-4000-8000-0000000000e1";

vi.mock("@neondatabase/serverless", () => {
  const handler = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const q = strings.join(" ");
    if (q.includes("auth_app_profile")) {
      const role: Record<string, string> = { "neon-super-admin": "SUPER_ADMIN", "neon-manager": "MANAGER", "neon-accountant": "ACCOUNTANT", "neon-se": "SALES_EXECUTIVE" };
      const uid: Record<string, string> = { "neon-super-admin": SUPER_ADMIN_ID, "neon-manager": MANAGER_ID, "neon-accountant": ACCOUNTANT_ID, "neon-se": SE_ID };
      const s = values[0] as string;
      return [{ role: role[s], userId: uid[s] ?? SUPER_ADMIN_ID, enterpriseId: ENT }];
    }
    if (q.includes("role_permission_overrides")) return []; // salary.* default OFF for office
    if (q.includes("current_salary")) return [{ monthly_amount: "20000" }];
    if (q.includes("my_advance_outstanding")) return [{ outstanding: "8000" }];
    if (q.includes("my_salary_this_month")) return [];
    if (q.includes("list_salaries")) return [{ userId: SE_ID, userName: "Priya", salary: "20000", advanceOutstanding: "0", paidThisMonth: false }];
    if (q.includes("list_staff")) return [{ id: SE_ID, name: "Priya", role: "SALES_EXECUTIVE" }];
    if (q.includes("salary_payment_dupe")) return [];
    if (q.includes("salary_category")) return [{ id: "cat-sal" }];
    if (q.includes("next_salary_exp_code")) return [{ seq: 5 }];
    if (q.includes("get_salary_payment")) return [{ id: "p1", userId: SE_ID, userName: "Priya", gross: "20000", recovered: "0", net: "20000", expenditureId: "exp-1", reversedAt: null }];
    if (q.includes("salary_recoveries")) return [];
    return [];
  };
  handler.query = async (text: string) => (text.includes("active_advances_for_recovery") ? [] : []);
  return { neon: () => handler };
});

const env = { DATABASE_URL: "postgresql://example.test/db", ...authTestEnv };
const jh = (s: string) => ({ "Content-Type": "application/json", ...authHeaders(s) });

describe("salary routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(installAuthFetchMock()));
  });

  test("SE sees their own salary; office cannot use /mine", async () => {
    const { default: app } = await import("../index");
    const ok = await app.request("/api/v1/salary/mine", { headers: authHeaders("neon-se") }, env);
    expect(ok.status).toBe(200);
    expect((await ok.json()).data).toMatchObject({ monthlySalary: 20000, advanceOutstanding: 8000 });
    expect((await app.request("/api/v1/salary/mine", { headers: authHeaders("neon-manager") }, env)).status).toBe(403);
  });

  test("salary table + staff need salary.view — Super Admin yes, Manager no by default", async () => {
    const { default: app } = await import("../index");
    expect((await app.request("/api/v1/salary", { headers: authHeaders("neon-super-admin") }, env)).status).toBe(200);
    expect((await app.request("/api/v1/salary", { headers: authHeaders("neon-manager") }, env)).status).toBe(403);
    expect((await app.request("/api/v1/salary/staff", { headers: authHeaders("neon-super-admin") }, env)).status).toBe(200);
    expect((await app.request("/api/v1/salary/staff", { headers: authHeaders("neon-se") }, env)).status).toBe(403);
  });

  test("set salary needs salary.manage — Super Admin yes, Manager no by default", async () => {
    const { default: app } = await import("../index");
    const ok = await app.request("/api/v1/salary/set", { method: "POST", headers: jh("neon-super-admin"), body: JSON.stringify({ userId: SE_ID, amount: 20000 }) }, env);
    expect(ok.status).toBe(200);
    const no = await app.request("/api/v1/salary/set", { method: "POST", headers: jh("neon-manager"), body: JSON.stringify({ userId: SE_ID, amount: 20000 }) }, env);
    expect(no.status).toBe(403);
    const noAmount = await app.request("/api/v1/salary/set", { method: "POST", headers: jh("neon-super-admin"), body: JSON.stringify({ userId: SE_ID }) }, env);
    expect(noAmount.status).toBe(422); // amount defaults to 0 → rejected
  });

  test("pay salary needs salary.manage and returns the net", async () => {
    const { default: app } = await import("../index");
    const ok = await app.request("/api/v1/salary/pay", { method: "POST", headers: jh("neon-super-admin"), body: JSON.stringify({ userId: SE_ID, periodMonth: "2026-11-01" }) }, env);
    expect(ok.status).toBe(201);
    expect((await ok.json()).data).toMatchObject({ gross: 20000, advanceRecovered: 0, net: 20000 });
    const no = await app.request("/api/v1/salary/pay", { method: "POST", headers: jh("neon-accountant"), body: JSON.stringify({ userId: SE_ID, periodMonth: "2026-11-01" }) }, env);
    expect(no.status).toBe(403);
  });

  test("void a salary run needs salary.manage — Super Admin yes, Accountant no", async () => {
    const { default: app } = await import("../index");
    const ok = await app.request("/api/v1/salary/p1/void", { method: "POST", headers: jh("neon-super-admin"), body: JSON.stringify({ reason: "wrong month" }) }, env);
    expect(ok.status).toBe(200);
    expect((await ok.json()).data).toMatchObject({ id: "p1", advanceRestored: 0 });
    const no = await app.request("/api/v1/salary/p1/void", { method: "POST", headers: jh("neon-accountant"), body: JSON.stringify({}) }, env);
    expect(no.status).toBe(403); // salary.manage OFF for office by default
  });
});
