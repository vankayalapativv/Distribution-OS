import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, installAuth } from "../test/route-harness";
vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => ({})) };
});
vi.mock("../lib/razorpay", () => ({ verifyWebhookSignature: vi.fn().mockResolvedValue(true) }));
beforeEach(() => { vi.resetModules(); installAuth(); });
const app = () => import("../index").then((m) => m.default);
const env = { ...ENV, RAZORPAY_WEBHOOK_SECRET: "whsec" };
describe("razorpay webhook invalid JSON", () => {
  it("400s when the (signature-valid) body is not JSON", async () => {
    const res = await (await app()).request("/api/v1/webhooks/razorpay", {
      method: "POST",
      headers: { "x-razorpay-signature": "sig", "x-razorpay-event-id": "evt_1", "content-type": "application/json" },
      body: "not-json{",
    }, env);
    expect(res.status).toBe(400);
  });
});
