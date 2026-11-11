import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, headers, installAuth } from "../test/route-harness";

const H = vi.hoisted(() => ({ responses: {} as Record<string, unknown[]> }));
vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => H.responses) };
});
beforeEach(() => {
  vi.resetModules();
  H.responses = {
    list_audit_logs_paged_count: [{ total: 1 }],
    list_audit_logs_paged: [{ id: "a1", createdAt: "2026-06-01", actorName: "Admin", action: "x.y", summary: "s" }],
    audit_filter_actors: [{ id: "u1", name: "Admin" }],
    audit_filter_entity_types: [{ value: "customer" }],
    audit_filter_actions: [{ value: "x.y" }],
  };
  installAuth();
});

describe("audit-logs routes (SUPER_ADMIN only)", () => {
  it("GET /paged with filters", async () => {
    const { default: app } = await import("../index");
    const res = await app.request("/api/v1/audit-logs/paged?q=ravi&actorId=u1&page=1&pageSize=20", { headers: headers("superAdmin") }, ENV);
    expect(res.status).toBe(200);
    expect((await res.json()).data.total).toBe(1);
  });
  it("GET /filters", async () => {
    const { default: app } = await import("../index");
    expect((await app.request("/api/v1/audit-logs/filters", { headers: headers("superAdmin") }, ENV)).status).toBe(200);
  });
  it("403s a manager", async () => {
    const { default: app } = await import("../index");
    expect((await app.request("/api/v1/audit-logs/paged", { headers: headers("manager") }, ENV)).status).toBe(403);
  });
});
