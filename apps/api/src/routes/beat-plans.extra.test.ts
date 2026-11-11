import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, headers, installAuth } from "../test/route-harness";
vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => ({})) };
});
vi.mock("../services/beat-plans", () => ({
  getBeatTemplate: vi.fn().mockResolvedValue([]),
  listBeatExecutives: vi.fn().mockResolvedValue([]),
}));
vi.mock("../services/beat-assign", () => ({
  assignCustomerToDay: vi.fn().mockResolvedValue({ ok: true }),
  reorderBeatDay: vi.fn().mockResolvedValue({ ok: true }),
  unassignCustomer: vi.fn().mockResolvedValue({ ok: true }),
}));
const jh = () => ({ ...headers("superAdmin"), "content-type": "application/json" });
beforeEach(() => { vi.resetModules(); installAuth(); });
const app = () => import("../index").then((m) => m.default);
describe("beat-plans reorder + unassign", () => {
  it("PUT /reorder — 422 bad ids, 200 ok", async () => {
    expect((await (await app()).request("/api/v1/beat-plans/reorder", { method: "PUT", headers: jh(), body: JSON.stringify({ executiveId: "se-1", weekday: 1, customerIds: [1, 2] }) }, ENV)).status).toBe(422);
    expect((await (await app()).request("/api/v1/beat-plans/reorder", { method: "PUT", headers: jh(), body: JSON.stringify({ executiveId: "se-1", weekday: 1, customerIds: ["c1", "c2"] }) }, ENV)).status).toBe(200);
  });
  it("DELETE /assign/:customerId", async () => {
    expect((await (await app()).request("/api/v1/beat-plans/assign/c1", { method: "DELETE", headers: headers("manager") }, ENV)).status).toBe(200);
  });
});
