import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, headers, installAuth } from "../test/route-harness";

vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => ({})) };
});
vi.mock("../services/audit", () => ({ actorOf: () => ({}), logAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../services/permissions", () => ({
  CONFIGURABLE_ROLES: ["MANAGER", "ACCOUNTANT"],
  isConfigurableRole: (r: string) => r === "MANAGER" || r === "ACCOUNTANT",
  getPermissionMatrix: vi.fn().mockResolvedValue({ roles: [] }),
  setRolePermissions: vi.fn().mockResolvedValue([{ key: "nav:x", allowed: true }]),
}));

beforeEach(() => { vi.resetModules(); installAuth(); });

describe("permissions routes (SUPER_ADMIN)", () => {
  it("GET / returns the matrix", async () => {
    const { default: app } = await import("../index");
    expect((await app.request("/api/v1/permissions", { headers: headers("superAdmin") }, ENV)).status).toBe(200);
  });
  it("PUT /:role 422s an unconfigurable role", async () => {
    const { default: app } = await import("../index");
    const res = await app.request("/api/v1/permissions/SUPER_ADMIN", { method: "PUT", headers: { ...headers("superAdmin"), "content-type": "application/json" }, body: "{}" }, ENV);
    expect(res.status).toBe(422);
  });
  it("PUT /:role filters entries and updates", async () => {
    const { default: app } = await import("../index");
    const body = { entries: [{ key: "nav:x", allowed: true }, { key: "nav:y", allowed: false }, { bad: 1 }, null] };
    const res = await app.request("/api/v1/permissions/MANAGER", { method: "PUT", headers: { ...headers("superAdmin"), "content-type": "application/json" }, body: JSON.stringify(body) }, ENV);
    expect(res.status).toBe(200);
    expect((await res.json()).data.role).toBe("MANAGER");
  });
  it("PUT /:role handles a single-entry (singular) summary", async () => {
    const { default: app } = await import("../index");
    const res = await app.request("/api/v1/permissions/ACCOUNTANT", { method: "PUT", headers: { ...headers("superAdmin"), "content-type": "application/json" }, body: JSON.stringify({ entries: [{ key: "nav:x", allowed: true }] }) }, ENV);
    expect(res.status).toBe(200);
  });
});
