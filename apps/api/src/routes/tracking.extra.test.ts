import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, headers, installAuth } from "../test/route-harness";
vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => ({})) };
});
vi.mock("../services/tracking", () => ({
  assertTrackingDate: (v: string) => v,
  getExecutiveCheckins: vi.fn().mockResolvedValue([]),
  getExecutiveRoute: vi.fn().mockResolvedValue([]),
  listDeviceHealth: vi.fn().mockResolvedValue([]),
  listTrackedExecutives: vi.fn().mockResolvedValue([]),
}));
beforeEach(() => { vi.resetModules(); installAuth(); });
const app = () => import("../index").then((m) => m.default);
describe("tracking checkins + device-health", () => {
  it("GET /checkins — 422 without userId, 200 with", async () => {
    expect((await (await app()).request("/api/v1/tracking/checkins", { headers: headers("manager") }, ENV)).status).toBe(422);
    expect((await (await app()).request("/api/v1/tracking/checkins?userId=se-1&date=2026-06-10", { headers: headers("manager") }, ENV)).status).toBe(200);
  });
  it("GET /device-health", async () => {
    expect((await (await app()).request("/api/v1/tracking/device-health", { headers: headers("superAdmin") }, ENV)).status).toBe(200);
  });
});
