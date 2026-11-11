import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, headers, installAuth } from "../test/route-harness";

const M = vi.hoisted(() => ({ access: vi.fn(), receipt: vi.fn(), order: vi.fn(), verify: vi.fn() }));
vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => ({})) };
});
vi.mock("../services/billing-v2", () => ({
  getBillingAccess: (...a: unknown[]) => M.access(...a),
  listCharges: vi.fn().mockResolvedValue([]),
  getReceipt: (...a: unknown[]) => M.receipt(...a),
  ensureOrderForCharge: (...a: unknown[]) => M.order(...a),
  isBillingEnforced: () => true,
}));
vi.mock("../lib/razorpay", () => ({ verifyOrderPaymentSignature: (...a: unknown[]) => M.verify(...a) }));

const SECRET_ENV = { ...ENV, RAZORPAY_KEY_SECRET: "sek", RAZORPAY_KEY_ID: "rzp_test" };
const jh = (r: Parameters<typeof headers>[0] = "superAdmin") => ({ ...headers(r), "content-type": "application/json" });
beforeEach(() => { vi.resetModules(); installAuth(); Object.values(M).forEach((f) => f.mockReset()); });
const app = () => import("../index").then((m) => m.default);

describe("billing-v2 routes", () => {
  it("GET /access returns flags", async () => {
    M.access.mockResolvedValue({ current: null });
    const res = await (await app()).request("/api/v1/billing/access", { headers: headers("superAdmin") }, ENV);
    const j = await res.json();
    expect(j.data.canPay).toBe(true);
    expect(j.data.isAdmin).toBe(true);
  });
  it("GET /charges lists", async () => {
    expect((await (await app()).request("/api/v1/billing/charges", { headers: headers("accountant") }, ENV)).status).toBe(200);
  });
  it("GET /receipt/:id — 404 then 200", async () => {
    M.receipt.mockResolvedValueOnce(null);
    expect((await (await app()).request("/api/v1/billing/receipt/x", { headers: headers("manager") }, ENV)).status).toBe(404);
    M.receipt.mockResolvedValueOnce({ id: "x" });
    expect((await (await app()).request("/api/v1/billing/receipt/x", { headers: headers("manager") }, ENV)).status).toBe(200);
  });
  it("POST /pay — 409 nothing due, 503 order fail, 200 ok", async () => {
    M.access.mockResolvedValue({ current: null });
    expect((await (await app()).request("/api/v1/billing/pay", { method: "POST", headers: jh(), body: "{}" }, ENV)).status).toBe(409);
    M.access.mockResolvedValue({ current: { id: "ch1", status: "pending", amountPaisa: 100, seats: 1, periodStart: "2026-06-01" } });
    M.order.mockResolvedValueOnce(null);
    expect((await (await app()).request("/api/v1/billing/pay", { method: "POST", headers: jh(), body: "{}" }, ENV)).status).toBe(503);
    M.order.mockResolvedValueOnce("order_1");
    expect((await (await app()).request("/api/v1/billing/pay", { method: "POST", headers: jh(), body: "{}" }, ENV)).status).toBe(200);
  });
  it("POST /confirm — 500 no secret, 400 bad sig, 200 verified", async () => {
    const body = JSON.stringify({ razorpayOrderId: "o", razorpayPaymentId: "p", razorpaySignature: "s" });
    expect((await (await app()).request("/api/v1/billing/confirm", { method: "POST", headers: jh("se"), body }, ENV)).status).toBe(500);
    M.verify.mockResolvedValueOnce(false);
    expect((await (await app()).request("/api/v1/billing/confirm", { method: "POST", headers: jh("se"), body }, SECRET_ENV)).status).toBe(400);
    M.verify.mockResolvedValueOnce(true);
    expect((await (await app()).request("/api/v1/billing/confirm", { method: "POST", headers: jh("se"), body }, SECRET_ENV)).status).toBe(200);
  });
});
