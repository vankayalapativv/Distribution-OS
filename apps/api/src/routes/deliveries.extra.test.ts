import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, headers, installAuth } from "../test/route-harness";
vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => ({})) };
});
vi.mock("../lib/wait-until", () => ({ waitUntilSafe: vi.fn() }));
vi.mock("../services/audit", () => ({ actorOf: () => ({}), logAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../services/invoices", () => ({ sendExpoPush: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../services/deliveries", () => ({
  startRun: vi.fn(), endRun: vi.fn(), getActiveRun: vi.fn(),
  uploadDeliveryPhoto: vi.fn(),
  addStop: vi.fn().mockResolvedValue({ existing: false, push: { tokens: ["t"], title: "T", body: "B" } }),
  deliverableInvoices: vi.fn().mockResolvedValue([]),
}));
const jh = () => ({ ...headers("logistics"), "content-type": "application/json" });
beforeEach(() => { vi.resetModules(); installAuth(); });
const app = () => import("../index").then((m) => m.default);
describe("deliveries stop-push + pending-invoices", () => {
  it("POST /runs/:id/stops fires the delivered push", async () => {
    const res = await (await app()).request("/api/v1/deliveries/runs/r1/stops", { method: "POST", headers: jh(), body: JSON.stringify({ customerId: "c1", invoiceId: "i1" }) }, ENV);
    expect(res.status).toBe(201);
  });
  it("GET /pending-invoices (global + scoped)", async () => {
    expect((await (await app()).request("/api/v1/deliveries/pending-invoices", { headers: headers("superAdmin") }, ENV)).status).toBe(200);
    expect((await (await app()).request("/api/v1/deliveries/pending-invoices?customerId=c1", { headers: headers("logistics") }, ENV)).status).toBe(200);
  });
});
