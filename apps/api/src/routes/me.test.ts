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
const h = vi.hoisted(() => ({
  getMyProfile: vi.fn(),
  neonSignIn: vi.fn(),
  neonChangePassword: vi.fn(),
  neonSignOut: vi.fn(),
}));
vi.mock("../services/me-profile", () => ({
  getMyProfile: h.getMyProfile,
  updateMyProfile: vi.fn().mockResolvedValue({ id: "u1", name: "Admin" }),
}));
vi.mock("../services/mobile-auth", () => ({
  neonSignIn: (...a: unknown[]) => h.neonSignIn(...a),
  neonChangePassword: (...a: unknown[]) => h.neonChangePassword(...a),
  neonSignOut: (...a: unknown[]) => h.neonSignOut(...a),
}));

const json = (r: Parameters<typeof headers>[0], b: unknown) => ({ ...headers(r), "content-type": "application/json" });
const changePw = (body: unknown) => app().then((a) =>
  a.request("/api/v1/me/change-password", { method: "POST", headers: json("se", 0), body: JSON.stringify(body) }, ENV));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  installAuth();
  h.getMyProfile.mockResolvedValue({ id: "u1", name: "Admin", email: "a@b.c", phone: null });
  h.neonSignIn.mockResolvedValue({ ok: true, session: "sess", user: { id: "u1", name: "Admin", email: "a@b.c" } });
  h.neonChangePassword.mockResolvedValue({ ok: true });
  h.neonSignOut.mockResolvedValue(undefined);
});
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

  describe("POST /me/change-password", () => {
    it("verifies the current password, changes it, cleans up the throwaway session", async () => {
      const res = await changePw({ currentPassword: "old", newPassword: "abcd1234" });
      expect(res.status).toBe(200);
      expect(h.neonSignIn).toHaveBeenCalledWith(ENV, "a@b.c", "old");
      expect(h.neonChangePassword).toHaveBeenCalledWith(ENV, "sess", "old", "abcd1234");
      expect(h.neonSignOut).toHaveBeenCalledWith(ENV, "sess");
    });
    it("rejects a weak new password (422) before touching Neon", async () => {
      const res = await changePw({ currentPassword: "old", newPassword: "abcdefgh" }); // no digit
      expect(res.status).toBe(422);
      expect(h.neonSignIn).not.toHaveBeenCalled();
    });
    it("rejects a wrong current password with 401", async () => {
      h.neonSignIn.mockResolvedValue({ ok: false, status: 401, error: "bad" });
      const res = await changePw({ currentPassword: "nope", newPassword: "abcd1234" });
      expect(res.status).toBe(401);
      expect(h.neonChangePassword).not.toHaveBeenCalled();
    });
    it("maps an upstream sign-in failure to 503", async () => {
      h.neonSignIn.mockResolvedValue({ ok: false, status: 503, error: "down" });
      expect((await changePw({ currentPassword: "old", newPassword: "abcd1234" })).status).toBe(503);
    });
    it("maps a change-password failure (400 → 400, 503 → 503)", async () => {
      h.neonChangePassword.mockResolvedValueOnce({ ok: false, status: 400, error: "x" });
      expect((await changePw({ currentPassword: "old", newPassword: "abcd1234" })).status).toBe(400);
      h.neonChangePassword.mockResolvedValueOnce({ ok: false, status: 503, error: "x" });
      expect((await changePw({ currentPassword: "old", newPassword: "abcd1234" })).status).toBe(503);
    });
    it("409s when the account has no email", async () => {
      h.getMyProfile.mockResolvedValue({ id: "u1", name: "Admin", email: null, phone: null });
      expect((await changePw({ currentPassword: "old", newPassword: "abcd1234" })).status).toBe(409);
    });
  });
});
