import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, headers, installAuth } from "../test/route-harness";
vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => ({})) };
});
vi.mock("../services/audit", () => ({ actorOf: () => ({}), logAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../services/market-intelligence", () => ({
  createMarketNote: vi.fn().mockResolvedValue({ id: "n1" }),
  deleteMarketNote: vi.fn().mockResolvedValue(undefined),
  listMarketNotes: vi.fn().mockResolvedValue([]),
  listMarketPhotos: vi.fn().mockResolvedValue([]),
  updateMarketNote: vi.fn().mockResolvedValue({ id: "n1" }),
}));
const jh = () => ({ ...headers("manager"), "content-type": "application/json" });
beforeEach(() => { vi.resetModules(); installAuth(); });
const app = () => import("../index").then((m) => m.default);
describe("market-intelligence parseItems guards", () => {
  it("POST /notes — 422 when items is not an array", async () => {
    const res = await (await app()).request("/api/v1/market-intelligence/notes", { method: "POST", headers: jh(), body: JSON.stringify({ seUserId: "se-1", items: "nope" }) }, ENV);
    expect(res.status).toBe(422);
  });
  it("POST /notes — 422 when an item is not an object", async () => {
    const res = await (await app()).request("/api/v1/market-intelligence/notes", { method: "POST", headers: jh(), body: JSON.stringify({ seUserId: "se-1", items: [123] }) }, ENV);
    expect(res.status).toBe(422);
  });
});
