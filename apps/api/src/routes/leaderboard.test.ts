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
    leaderboard_oil_litres: [{ userId: "se-1", name: "Asha", today: "5", week: "20", month: "60" }],
    leaderboard_oil_segments: [{ userId: "se-1", name: "Asha", segment: "Car", today: "5", week: "20", month: "60" }],
  };
  installAuth();
});

describe("leaderboard routes", () => {
  it("GET / returns the oil leaderboard for an SE", async () => {
    const { default: app } = await import("../index");
    const res = await app.request("/api/v1/leaderboard", { headers: headers("se") }, ENV);
    expect(res.status).toBe(200);
    expect((await res.json()).data.leaderboard).toHaveLength(1);
  });
  it("GET /segments is SUPER_ADMIN-only (200 SA, 403 SE)", async () => {
    const { default: app } = await import("../index");
    expect((await app.request("/api/v1/leaderboard/segments", { headers: headers("superAdmin") }, ENV)).status).toBe(200);
    expect((await app.request("/api/v1/leaderboard/segments", { headers: headers("se") }, ENV)).status).toBe(403);
  });
});
