import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, headers, installAuth } from "../test/route-harness";

vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => ({})) };
});
vi.mock("../services/audit", () => ({ actorOf: () => ({}), logAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../services/invoices", () => ({
  registerPushToken: vi.fn().mockResolvedValue({ ok: true }),
  listMyNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn().mockResolvedValue({ ok: true }),
  clearNotifications: vi.fn().mockResolvedValue({ cleared: 1 }),
  deleteNotification: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("../services/badges", () => ({ getBadgeCounts: vi.fn().mockResolvedValue({ orders: 0 }) }));
vi.mock("../services/tasks", () => ({
  listMyAssignedTasks: vi.fn().mockResolvedValue([]),
  markMyTaskDone: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("../services/section-seen", () => ({
  countSectionUpdates: vi.fn().mockResolvedValue(0),
  markSectionSeen: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("../services/permissions", () => ({ effectivePermissionsForRole: vi.fn().mockResolvedValue([]) }));
vi.mock("../services/me-profile", () => ({
  getMyProfile: vi.fn().mockResolvedValue({ id: "u1", name: "Admin" }),
  updateMyProfile: vi.fn().mockResolvedValue({ id: "u1", name: "Admin" }),
}));

const json = (r: Parameters<typeof headers>[0], b: unknown) => ({ ...headers(r), "content-type": "application/json" });
beforeEach(() => { vi.resetModules(); installAuth(); });
const app = () => import("../index").then((m) => m.default);

describe("me routes", () => {
  it("GET /me returns auth + permissions", async () => {
    expect((await (await app()).request("/api/v1/me", { headers: headers("manager") }, ENV)).status).toBe(200);
  });
  it("profile get + patch", async () => {
    expect((await (await app()).request("/api/v1/me/profile", { headers: headers("manager") }, ENV)).status).toBe(200);
    const res = await (await app()).request("/api/v1/me/profile", { method: "PATCH", headers: json("manager", 0), body: JSON.stringify({ name: "A", phone: "1" }) }, ENV);
    expect(res.status).toBe(200);
  });
  it("push-token + notifications feed", async () => {
    expect((await (await app()).request("/api/v1/me/push-token", { method: "POST", headers: json("se", 0), body: JSON.stringify({ token: "t", platform: "android" }) }, ENV)).status).toBe(200);
    expect((await (await app()).request("/api/v1/me/notifications", { headers: headers("se") }, ENV)).status).toBe(200);
    expect((await (await app()).request("/api/v1/me/notifications/n1/read", { method: "POST", headers: json("se", 0), body: "{}" }, ENV)).status).toBe(200);
    expect((await (await app()).request("/api/v1/me/notifications", { method: "DELETE", headers: headers("se") }, ENV)).status).toBe(200);
    expect((await (await app()).request("/api/v1/me/notifications/n1", { method: "DELETE", headers: headers("se") }, ENV)).status).toBe(200);
  });
  it("SE tasks list + done", async () => {
    expect((await (await app()).request("/api/v1/me/tasks", { headers: headers("se") }, ENV)).status).toBe(200);
    expect((await (await app()).request("/api/v1/me/tasks/t1/done", { method: "POST", headers: json("se", 0), body: "{}" }, ENV)).status).toBe(200);
  });
  it("office section-seen + section-updates", async () => {
    expect((await (await app()).request("/api/v1/me/section-seen", { method: "POST", headers: json("manager", 0), body: JSON.stringify({ section: "orders" }) }, ENV)).status).toBe(200);
    expect((await (await app()).request("/api/v1/me/section-updates?section=orders&since=2026-06-01", { headers: headers("manager") }, ENV)).status).toBe(200);
  });
  it("badge-counts, permissions, scope", async () => {
    expect((await (await app()).request("/api/v1/me/badge-counts", { headers: headers("manager") }, ENV)).status).toBe(200);
    expect((await (await app()).request("/api/v1/me/permissions", { headers: headers("se") }, ENV)).status).toBe(200);
    expect((await (await app()).request("/api/v1/me/scope", { headers: headers("se") }, ENV)).status).toBe(200);
  });
});
