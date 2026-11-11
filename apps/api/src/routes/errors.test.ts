import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, headers, installAuth } from "../test/route-harness";

const M = vi.hoisted(() => ({ detail: vi.fn(), update: vi.fn() }));
vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => ({})) };
});
vi.mock("../services/errors", () => ({
  captureError: vi.fn().mockResolvedValue(undefined),
  errorSummary: vi.fn().mockResolvedValue({ open: 0 }),
  listErrorGroups: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
  getErrorGroupDetail: (...a: unknown[]) => M.detail(...a),
  updateErrorGroup: (...a: unknown[]) => M.update(...a),
  addErrorNote: vi.fn().mockResolvedValue({ id: "note1" }),
}));
vi.mock("../services/tasks", () => ({ listTaskAssignees: vi.fn().mockResolvedValue([]) }));

const UUID = "11111111-2222-4333-8444-555555555555";
const jh = (r: Parameters<typeof headers>[0] = "superAdmin") => ({ ...headers(r), "content-type": "application/json" });
beforeEach(() => { vi.resetModules(); installAuth(); M.detail.mockReset(); M.update.mockReset(); });
const app = () => import("../index").then((m) => m.default);

describe("errors routes", () => {
  it("POST /ingest accepts a client error (202)", async () => {
    const res = await (await app()).request("/api/v1/errors/ingest", { method: "POST", headers: jh("se"), body: JSON.stringify({ source: "mobile", message: "boom" }) }, ENV);
    expect(res.status).toBe(202);
  });
  it("GET /summary, /assignees, / (with and without paging)", async () => {
    expect((await (await app()).request("/api/v1/errors/summary", { headers: headers("superAdmin") }, ENV)).status).toBe(200);
    expect((await (await app()).request("/api/v1/errors/assignees", { headers: headers("superAdmin") }, ENV)).status).toBe(200);
    expect((await (await app()).request("/api/v1/errors?status=open&source=web&level=error&page=2&pageSize=10", { headers: headers("superAdmin") }, ENV)).status).toBe(200);
    expect((await (await app()).request("/api/v1/errors", { headers: headers("superAdmin") }, ENV)).status).toBe(200);
  });
  it("GET /:id — bad uuid 404, missing 404, found 200", async () => {
    expect((await (await app()).request("/api/v1/errors/not-a-uuid", { headers: headers("superAdmin") }, ENV)).status).toBe(404);
    M.detail.mockResolvedValueOnce(null);
    expect((await (await app()).request(`/api/v1/errors/${UUID}`, { headers: headers("superAdmin") }, ENV)).status).toBe(404);
    M.detail.mockResolvedValueOnce({ id: UUID });
    expect((await (await app()).request(`/api/v1/errors/${UUID}`, { headers: headers("superAdmin") }, ENV)).status).toBe(200);
  });
  it("PATCH /:id — invalid status 422, missing 404, ok 200", async () => {
    expect((await (await app()).request(`/api/v1/errors/${UUID}`, { method: "PATCH", headers: jh(), body: JSON.stringify({ status: "bogus" }) }, ENV)).status).toBe(422);
    M.update.mockResolvedValueOnce(false);
    expect((await (await app()).request(`/api/v1/errors/${UUID}`, { method: "PATCH", headers: jh(), body: JSON.stringify({ status: "resolved", assignedTo: null }) }, ENV)).status).toBe(404);
    M.update.mockResolvedValueOnce(true);
    expect((await (await app()).request(`/api/v1/errors/${UUID}`, { method: "PATCH", headers: jh(), body: JSON.stringify({ status: "open" }) }, ENV)).status).toBe(200);
  });
  it("POST /:id/notes — blank 422, ok 201", async () => {
    expect((await (await app()).request(`/api/v1/errors/${UUID}/notes`, { method: "POST", headers: jh(), body: JSON.stringify({ body: "  " }) }, ENV)).status).toBe(422);
    expect((await (await app()).request(`/api/v1/errors/${UUID}/notes`, { method: "POST", headers: jh(), body: JSON.stringify({ body: "Looking into it" }) }, ENV)).status).toBe(201);
  });
});
