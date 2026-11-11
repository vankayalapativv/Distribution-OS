/**
 * Phase 2 LIVE end-to-end scoping proof. Unlike the other route tests, this does
 * NOT mock neon — it drives the real Hono app + the real neon driver against a
 * real database, mocking only the JWKS fetch so a test-minted token verifies.
 *
 * Gated on LIVE_DATABASE_URL so it is skipped in normal CI. Run against the new
 * Neon DB (seed: Ent A has A-CUST-1, Ent B has B-CUST-1, user `test-sub-a` → Ent A):
 *   LIVE_DATABASE_URL="postgres://…" npx vitest run src/phase2-live.test.ts
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { authHeaders, authTestEnv, installAuthFetchMock } from "./test/auth";

const LIVE = process.env.LIVE_DATABASE_URL;
const suite = LIVE ? describe : describe.skip;

suite("Phase 2 — live enterprise scoping (real app, real DB)", () => {
  const ENV = { DATABASE_URL: LIVE, ...authTestEnv } as Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let realFetch: any;

  beforeAll(() => {
    realFetch = globalThis.fetch;
    // Serve the JWKS for token verification; pass every other fetch (the neon DB
    // calls) through to the real network.
    vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("auth.example.test")) {
        return Promise.resolve(Response.json(installAuthFetchMock()));
      }
      return realFetch(input, init);
    });
  });
  afterAll(() => vi.restoreAllMocks());

  async function listCustomerCodes(subject: string) {
    const { default: app } = await import("./index");
    const res = await app.request("/api/v1/customers?pageSize=50", { headers: authHeaders(subject) }, ENV);
    // the list endpoint returns data as an array (or {rows} depending on the view)
    const body = (await res.json()) as {
      data?: Array<Record<string, unknown>> | { rows?: Array<Record<string, unknown>> };
    };
    const rows = Array.isArray(body.data) ? body.data : (body.data?.rows ?? []);
    return { status: res.status, codes: rows.map((r) => String(r.customerCode ?? r.customer_code)) };
  }

  it("a SUPER_ADMIN of Enterprise A sees ONLY Enterprise A's customers", async () => {
    const { status, codes } = await listCustomerCodes("test-sub-a");
    expect(status).toBe(200);
    expect(codes).toContain("A-CUST-1"); // own enterprise
    expect(codes).not.toContain("B-CUST-1"); // other enterprise — RLS hides it
  });
});
