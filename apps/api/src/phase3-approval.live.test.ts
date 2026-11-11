/**
 * Phase 3b LIVE approval proof — onboard a pending enterprise, then approve it as
 * the platform owner, over the real app + real DB. Gated on LIVE_DATABASE_URL.
 *
 *   LIVE_DATABASE_URL="postgres://…" npx vitest run src/phase3-approval.live.test.ts
 */
import { neon } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { authHeaders, authTestEnv, installAuthFetchMock } from "./test/auth";

const LIVE = process.env.LIVE_DATABASE_URL;
const suite = LIVE ? describe : describe.skip;
const APPLICANT = "appr-applicant-1";
const OWNER = "appr-owner-1";

suite("Phase 3b — live approval (real app, real DB)", () => {
  const ENV = { DATABASE_URL: LIVE, ...authTestEnv } as Record<string, unknown>;
  const owner = neon((LIVE ?? "postgresql://u:p@localhost/db") as string);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let realFetch: any;
  let enterpriseId: string | undefined;

  const payload = {
    admin: { name: "Bea Admin", designation: "Owner" },
    company: { legalName: "Beta Oils LLP", gstin: "27BETA0000A1Z5", tradeName: "Beta", contactPhone: "9000000002", contactEmail: "ops@beta.test" },
    address: { line1: "7 Depot St", city: "Hyderabad", state: "Telangana", pincode: "500002" },
    bank: { bankName: "ICICI", accountName: "Beta Oils LLP", accountNumber: "222333444", ifsc: "ICIC0000222", upiId: "beta@icici" },
    invoice: { prefix: "BETA/2026-27/", finYear: "2026-27", startSeq: 1, terms: "Due in 15 days." },
    godowns: [{ name: "Depot", state: "Telangana", stateCode: "36" }],
    tracking: { seAutoStopHour: 19, logisticsAutoStopHour: 21 },
    duesBands: [{ fromDays: 0, toDays: 45, label: "0–45" }, { fromDays: 46, toDays: null, label: "46+" }],
  };

  async function purge() {
    const [u] = (await owner`select enterprise_id as e from users where app_login_id = ${APPLICANT}`) as Array<{ e: string | null }>;
    const e = u?.e ?? enterpriseId ?? null;
    if (e) {
      for (const t of ["system_settings", "stock_locations", "invoice_series", "dues_bands", "user_roles", "enterprise_billing_config"]) {
        await owner.query(`delete from ${t} where enterprise_id = $1`, [e]);
      }
      await owner`update enterprises set created_by = null, approved_by = null where id = ${e}`;
    }
    await owner`delete from users where app_login_id = ${APPLICANT}`;
    if (e) await owner`delete from enterprises where id = ${e}`;
    await owner`delete from platform_owners where auth_user_id = ${OWNER}`;
  }

  beforeAll(async () => {
    realFetch = globalThis.fetch;
    vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("auth.example.test")) return Promise.resolve(Response.json(installAuthFetchMock()));
      return realFetch(input, init);
    });
    await purge();
    await owner`insert into platform_owners (auth_user_id, name, email) values (${OWNER}, 'Platform Owner', 'owner@vardhan.test')`;
  });
  afterAll(async () => {
    await purge();
    vi.restoreAllMocks();
  });

  it("onboard → owner sees pending → approve+price → active + billing config", async () => {
    const { default: app } = await import("./index");
    const ah = { ...authHeaders(APPLICANT), "content-type": "application/json" };
    const oh = { ...authHeaders(OWNER), "content-type": "application/json" };

    // applicant onboards → pending
    await app.request("/api/v1/onboarding/account", { method: "POST", headers: ah, body: JSON.stringify({ name: "Bea" }) }, ENV);
    const sub = await app.request("/api/v1/onboarding/submit", { method: "POST", headers: ah, body: JSON.stringify({ payload }) }, ENV);
    enterpriseId = (await sub.json()).data.enterpriseId;

    // a NON-owner hitting /platform is forbidden
    const forbidden = await app.request("/api/v1/platform/enterprises", { headers: authHeaders(APPLICANT) }, ENV);
    expect(forbidden.status).toBe(403);

    // owner sees it in the pending queue
    const queue = await app.request("/api/v1/platform/enterprises?status=pending", { headers: authHeaders(OWNER) }, ENV);
    expect(queue.status).toBe(200);
    const ids = ((await queue.json()).data.enterprises as Array<{ id: string }>).map((e) => e.id);
    expect(ids).toContain(enterpriseId);

    // approve + set price (per-seat ₹708 incl.)
    const appr = await app.request(`/api/v1/platform/enterprises/${enterpriseId}/approve`, { method: "POST", headers: oh, body: JSON.stringify({ model: "per_seat", amountPaisa: 70800 }) }, ENV);
    expect(appr.status).toBe(200);
    expect((await appr.json()).data.status).toBe("active");

    // verify active + billing config landed
    const [ent] = (await owner`select status, approved_by as "approvedBy" from enterprises where id = ${enterpriseId}`) as Array<{ status: string; approvedBy: string | null }>;
    expect(ent.status).toBe("active");
    expect(ent.approvedBy).not.toBeNull();
    const [bc] = (await owner`select model, unit_amount_paisa as "unit", gst_rate_bp as "gst" from enterprise_billing_config where enterprise_id = ${enterpriseId}`) as Array<{ model: string; unit: number; gst: number }>;
    expect(bc.model).toBe("per_seat");
    expect(bc.unit).toBe(70800);
    expect(bc.gst).toBe(1800);
  });
});
