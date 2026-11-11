import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, headers, installAuth } from "../test/route-harness";

vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => ({})) };
});
vi.mock("../services/web-push-notify", () => ({
  vapidFromEnv: () => ({ publicKey: "vapidPub" }),
  saveWebPushSubscription: vi.fn().mockResolvedValue(undefined),
  deleteWebPushSubscription: vi.fn().mockResolvedValue(undefined),
}));

const h = () => ({ ...headers("manager"), "content-type": "application/json" });
beforeEach(() => { vi.resetModules(); installAuth(); });

describe("web-push routes", () => {
  it("GET /public-key returns the VAPID key", async () => {
    const { default: app } = await import("../index");
    const res = await app.request("/api/v1/web-push/public-key", { headers: headers("se") }, ENV);
    expect((await res.json()).data.publicKey).toBe("vapidPub");
  });
  it("POST /subscribe stores the subscription", async () => {
    const { default: app } = await import("../index");
    const body = { endpoint: "https://push.example/x", keys: { p256dh: "a", auth: "b" } };
    expect((await app.request("/api/v1/web-push/subscribe", { method: "POST", headers: h(), body: JSON.stringify(body) }, ENV)).status).toBe(200);
  });
  it("POST /unsubscribe removes it, 422 on blank endpoint", async () => {
    const { default: app } = await import("../index");
    expect((await app.request("/api/v1/web-push/unsubscribe", { method: "POST", headers: h(), body: JSON.stringify({ endpoint: "https://push.example/x" }) }, ENV)).status).toBe(200);
    expect((await app.request("/api/v1/web-push/unsubscribe", { method: "POST", headers: h(), body: JSON.stringify({}) }, ENV)).status).toBe(422);
  });
});
