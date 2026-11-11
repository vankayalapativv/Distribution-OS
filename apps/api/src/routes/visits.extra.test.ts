import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, headers, installAuth } from "../test/route-harness";
vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => ({})) };
});
vi.mock("../lib/wait-until", () => ({ waitUntilSafe: (_c: unknown, p: Promise<unknown>) => p }));
vi.mock("../services/visits", () => ({
  checkIn: vi.fn().mockResolvedValue({ existing: false, id: "v1" }),
  checkOut: vi.fn().mockResolvedValue({ id: "v1" }),
  batchGpsPings: vi.fn().mockResolvedValue({ inserted: 0 }),
  endGpsSession: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("../services/customers", () => ({ assertCustomerVisible: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../services/web-push-notify", () => ({
  customerName: vi.fn().mockResolvedValue("Ravi Motors"),
  executiveFirstName: vi.fn().mockResolvedValue("Asha"),
  notifyOfficeWebPush: vi.fn().mockResolvedValue(undefined),
  vapidFromEnv: () => ({ publicKey: "p", privateKey: "s", subject: "mailto:a@b.co" }),
}));
vi.mock("../services/admin-notify", () => ({ notifyAdmins: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../services/notify-format", () => ({ checkinBody: () => "Asha · Ravi Motors" }));
const jh = () => ({ ...headers("se"), "content-type": "application/json" });
beforeEach(() => { vi.resetModules(); installAuth(); });
const app = () => import("../index").then((m) => m.default);
describe("visits check-in fresh push path", () => {
  it("POST /checkin fires the office web-push block", async () => {
    const res = await (await app()).request("/api/v1/visits/checkin", { method: "POST", headers: jh(), body: JSON.stringify({ customerId: "c1", latitude: 17.4, longitude: 78.4, accuracy: 5 }) }, ENV);
    expect(res.status).toBe(201);
    await new Promise((r) => setTimeout(r, 20));
    const { notifyOfficeWebPush } = await import("../services/web-push-notify");
    expect(notifyOfficeWebPush).toHaveBeenCalled();
  });
});
