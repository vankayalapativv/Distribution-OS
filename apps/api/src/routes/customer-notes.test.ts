import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, headers, installAuth } from "../test/route-harness";

vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => ({})) };
});
vi.mock("../services/audit", () => ({ actorOf: () => ({}), logAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../services/customer-notes", () => ({
  listCustomerNotes: vi.fn().mockResolvedValue([]),
  createCustomerNote: vi.fn().mockResolvedValue({ id: "n1" }),
  updateCustomerNote: vi.fn().mockResolvedValue({ id: "n1" }),
  deleteCustomerNote: vi.fn().mockResolvedValue(undefined),
}));

const C = "c1";
const h = (r: Parameters<typeof headers>[0] = "superAdmin") => ({ ...headers(r), "content-type": "application/json" });
beforeEach(() => { vi.resetModules(); installAuth(); });

describe("customer-notes routes", () => {
  it("GET lists notes (SE allowed)", async () => {
    const { default: app } = await import("../index");
    expect((await app.request(`/api/v1/customers/${C}/notes`, { headers: headers("se") }, ENV)).status).toBe(200);
  });
  it("POST creates a note", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(`/api/v1/customers/${C}/notes`, { method: "POST", headers: h("manager"), body: JSON.stringify({ body: "Called today" }) }, ENV);
    expect(res.status).toBe(201);
  });
  it("POST 422s a blank note", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(`/api/v1/customers/${C}/notes`, { method: "POST", headers: h("manager"), body: JSON.stringify({ body: "   " }) }, ENV);
    expect(res.status).toBe(422);
  });
  it("PATCH edits (SUPER_ADMIN only)", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(`/api/v1/customers/${C}/notes/n1`, { method: "PATCH", headers: h(), body: JSON.stringify({ body: "Edited" }) }, ENV);
    expect(res.status).toBe(200);
  });
  it("DELETE removes (SUPER_ADMIN only)", async () => {
    const { default: app } = await import("../index");
    expect((await app.request(`/api/v1/customers/${C}/notes/n1`, { method: "DELETE", headers: headers("superAdmin") }, ENV)).status).toBe(200);
  });
});
