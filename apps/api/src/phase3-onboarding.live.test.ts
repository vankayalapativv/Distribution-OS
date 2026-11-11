/**
 * Phase 3a LIVE onboarding proof — drives the real app + real neon + real DB
 * (JWKS fetch mocked so a test-minted token verifies). Gated on LIVE_DATABASE_URL.
 *
 *   LIVE_DATABASE_URL="postgres://…" npx vitest run src/phase3-onboarding.live.test.ts
 */
import { neon } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { authHeaders, authTestEnv, installAuthFetchMock } from "./test/auth";

const LIVE = process.env.LIVE_DATABASE_URL;
const suite = LIVE ? describe : describe.skip;
const SUB = "onb-sub-phase3-1";

suite("Phase 3a — live onboarding (real app, real DB)", () => {
  const ENV = { DATABASE_URL: LIVE, ...authTestEnv } as Record<string, unknown>;
  // only constructed when the suite actually runs (LIVE is set)
  const owner = neon((LIVE ?? "postgresql://u:p@localhost/db") as string);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let realFetch: any;
  let enterpriseId: string | undefined;

  // Full purge of this test's user + its enterprise + config (resolves the
  // enterprise from the user, so it works even if a prior run left data).
  async function purge() {
    const [u] = (await owner`select enterprise_id as e from users where app_login_id = ${SUB}`) as Array<{ e: string | null }>;
    const e = u?.e ?? enterpriseId ?? null;
    if (e) {
      for (const t of ["system_settings", "stock_locations", "invoice_series", "dues_bands", "user_roles"]) {
        await owner.query(`delete from ${t} where enterprise_id = $1`, [e]);
      }
      await owner`update enterprises set created_by = null where id = ${e}`;
    }
    await owner`delete from users where app_login_id = ${SUB}`;
    if (e) await owner`delete from enterprises where id = ${e}`;
  }

  beforeAll(async () => {
    realFetch = globalThis.fetch;
    vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("auth.example.test")) return Promise.resolve(Response.json(installAuthFetchMock()));
      return realFetch(input, init);
    });
    await purge();
  });

  afterAll(async () => {
    await purge();
    vi.restoreAllMocks();
  });

  const payload = {
    admin: { name: "Asha Admin", designation: "Director" },
    company: { legalName: "Acme Lubricants LLP", gstin: "27ACME0000A1Z5", tradeName: "Acme", contactPhone: "9000000001", contactEmail: "ops@acme.test" },
    address: { line1: "12 Industrial Rd", line2: "Phase 2", city: "Hyderabad", state: "Telangana", pincode: "500001" },
    bank: { bankName: "HDFC", accountName: "Acme Lubricants LLP", accountNumber: "1234567890", ifsc: "HDFC0001234", upiId: "acme@hdfc" },
    invoice: { prefix: "ACM/2026-27/", finYear: "2026-27", startSeq: 1, terms: "Payment due in 30 days." },
    godowns: [{ name: "Main Godown", state: "Telangana", stateCode: "36", city: "Hyderabad" }],
    tracking: { seAutoStopHour: 20, logisticsAutoStopHour: 22 },
    duesBands: [
      { fromDays: 0, toDays: 30, label: "0–30" },
      { fromDays: 31, toDays: null, label: "31+" },
    ],
  };

  it("bootstrap → draft → submit → pending, with config written", async () => {
    const h = { ...authHeaders(SUB), "content-type": "application/json" };
    const { default: app } = await import("./index");

    // 1. bootstrap account
    const acct = await app.request("/api/v1/onboarding/account", { method: "POST", headers: h, body: JSON.stringify({ name: "Asha Admin" }) }, ENV);
    expect(acct.status).toBe(200);

    // 2. status = draft (account exists, no enterprise)
    const me1 = await app.request("/api/v1/onboarding/me", { headers: authHeaders(SUB) }, ENV);
    expect((await me1.json()).data.state).toBe("draft");

    // 3. submit
    const sub = await app.request("/api/v1/onboarding/submit", { method: "POST", headers: h, body: JSON.stringify({ payload }) }, ENV);
    expect(sub.status).toBe(201);
    const subBody = await sub.json();
    enterpriseId = subBody.data.enterpriseId;
    expect(subBody.data.status).toBe("pending");

    // 4. status = pending
    const me2 = await app.request("/api/v1/onboarding/me", { headers: authHeaders(SUB) }, ENV);
    const me2Body = await me2.json();
    expect(me2Body.data.state).toBe("pending");

    // 5. config landed (owner view)
    const [ent] = (await owner`select status, legal_name as "legalName" from enterprises where id = ${enterpriseId}`) as Array<{ status: string; legalName: string }>;
    expect(ent.status).toBe("pending");
    expect(ent.legalName).toBe("Acme Lubricants LLP");
    const [bands] = (await owner`select count(*)::int n from dues_bands where enterprise_id = ${enterpriseId}`) as Array<{ n: number }>;
    expect(bands.n).toBe(2);
    const [god] = (await owner`select count(*)::int n from stock_locations where enterprise_id = ${enterpriseId}`) as Array<{ n: number }>;
    expect(god.n).toBe(1);
    const [terms] = (await owner`select value from system_settings where enterprise_id = ${enterpriseId} and key = 'company_terms'`) as Array<{ value: string }>;
    expect(terms.value).toBe("Payment due in 30 days.");
    const [role] = (await owner`select r.code from user_roles ur join roles r on r.id = ur.role_id where ur.enterprise_id = ${enterpriseId}`) as Array<{ code: string }>;
    expect(role.code).toBe("SUPER_ADMIN");
  });
});
