import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, headers, installAuth } from "../test/route-harness";

const M = vi.hoisted(() => ({ token: vi.fn() }));
vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => ({})) };
});
vi.mock("../lib/wait-until", () => ({ waitUntilSafe: vi.fn() }));
vi.mock("../services/audit", () => ({ actorOf: () => ({}), logAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../services/customers", () => ({
  assertCustomerVisible: vi.fn().mockResolvedValue(undefined),
  createCustomer: vi.fn(), getCustomerById: vi.fn(), getCustomerLedger: vi.fn().mockResolvedValue({ rows: [] }),
  getCustomerLedgersBulk: vi.fn().mockResolvedValue({ customers: [] }),
  listCustomers: vi.fn(), listCustomersPaged: vi.fn().mockResolvedValue({ rows: [], total: 0, page: 1, pageSize: 20 }),
  listCustomerFilterOptions: vi.fn().mockResolvedValue({ cities: [], executives: [] }),
  listCustomerInvoices: vi.fn(), updateCustomer: vi.fn(), updateCustomerSeFields: vi.fn(), updateCustomerStatus: vi.fn(),
}));
vi.mock("../services/customer-statement", () => ({ ensureStatementToken: (...a: unknown[]) => M.token(...a) }));
vi.mock("../services/customer-visits", () => ({ getCustomerVisits: vi.fn().mockResolvedValue({ rows: [] }) }));
vi.mock("../services/customer-reassign", () => ({
  getReassignPreview: vi.fn().mockResolvedValue({ current: {} }),
  reassignCustomer: vi.fn().mockResolvedValue({ toUserName: "B", fromUserName: "A" }),
  undoReassignment: vi.fn().mockResolvedValue({ fromUserName: "A" }),
}));
vi.mock("../services/beat-assign", () => ({ enrollCustomerInTodayBeat: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../services/admin-notify", () => ({ notifyAdmins: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../services/opening-balance", () => ({
  // Invoke the reconcile callback the route passes, so its arrow body is covered.
  clearOpeningBalance: vi.fn(async (_s: unknown, _c: unknown, _id: unknown, recon?: () => Promise<void>) => { await recon?.(); }),
  getOpeningBalance: vi.fn().mockResolvedValue({ openingAmount: 0 }),
  upsertOpeningBalance: vi.fn(async (_s: unknown, _c: unknown, _id: unknown, _d: unknown, recon?: () => Promise<void>) => {
    await recon?.();
    return { openingAmount: 1000, asOfDate: "2026-06-01" };
  }),
}));
vi.mock("../services/collections", () => ({ reReconcileCustomer: vi.fn().mockResolvedValue(undefined) }));

const jh = (r: Parameters<typeof headers>[0] = "superAdmin") => ({ ...headers(r), "content-type": "application/json" });
beforeEach(() => { vi.resetModules(); installAuth(); M.token.mockReset(); });
const app = () => import("../index").then((m) => m.default);

describe("customers — paged/filter/opening/ledger/statement/visits/reassign", () => {
  it("GET /paged and /filter-options", async () => {
    expect((await (await app()).request("/api/v1/customers/paged?status=active&search=x&city=Hyd&salesExecutiveId=se-1&dues=0_30&sort=name&dir=asc&page=1&pageSize=20", { headers: headers("manager") }, ENV)).status).toBe(200);
    expect((await (await app()).request("/api/v1/customers/filter-options?executiveId=se-1", { headers: headers("accountant") }, ENV)).status).toBe(200);
  });
  it("opening-balance get/put/delete", async () => {
    expect((await (await app()).request("/api/v1/customers/c1/opening-balance", { headers: headers("manager") }, ENV)).status).toBe(200);
    expect((await (await app()).request("/api/v1/customers/c1/opening-balance", { method: "PUT", headers: jh("accountant"), body: JSON.stringify({ asOfDate: "2026-06-01", openingAmount: 1000 }) }, ENV)).status).toBe(200);
    expect((await (await app()).request("/api/v1/customers/c1/opening-balance", { method: "DELETE", headers: headers("superAdmin") }, ENV)).status).toBe(200);
  });
  it("ledgers/bulk and :id/ledger", async () => {
    expect((await (await app()).request("/api/v1/customers/ledgers/bulk?since=2026-06-01", { headers: headers("se") }, ENV)).status).toBe(200);
    expect((await (await app()).request("/api/v1/customers/c1/ledger?from=2026-06-01&to=2026-06-30", { headers: headers("manager") }, ENV)).status).toBe(200);
  });
  it("statement-token — 200 with a token, 404 when none", async () => {
    M.token.mockResolvedValueOnce("tok-123");
    expect((await (await app()).request("/api/v1/customers/c1/statement-token", { method: "POST", headers: jh("manager"), body: "{}" }, ENV)).status).toBe(200);
    M.token.mockResolvedValueOnce(null);
    expect((await (await app()).request("/api/v1/customers/c1/statement-token", { method: "POST", headers: jh("manager"), body: "{}" }, ENV)).status).toBe(404);
  });
  it("visits + reassign preview/apply/undo", async () => {
    expect((await (await app()).request("/api/v1/customers/c1/visits?from=2026-06-01&to=2026-06-30&page=1&pageSize=8", { headers: headers("manager") }, ENV)).status).toBe(200);
    expect((await (await app()).request("/api/v1/customers/c1/reassign/preview", { headers: headers("superAdmin") }, ENV)).status).toBe(200);
    expect((await (await app()).request("/api/v1/customers/c1/reassign", { method: "POST", headers: jh(), body: JSON.stringify({ toUserId: "se-2" }) }, ENV)).status).toBe(200);
    expect((await (await app()).request("/api/v1/customers/c1/reassign/undo", { method: "POST", headers: jh(), body: "{}" }, ENV)).status).toBe(200);
  });
});
