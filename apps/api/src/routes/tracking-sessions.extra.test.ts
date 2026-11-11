import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, headers, installAuth } from "../test/route-harness";
vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => ({})) };
});
vi.mock("../lib/wait-until", () => ({ waitUntilSafe: vi.fn() }));
vi.mock("../services/admin-notify", () => ({ notifyAdminsOfDayEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../services/tracking-sessions", () => ({
  startTrackingSession: vi.fn().mockResolvedValue({ existing: false, session: { startedAt: "t" } }),
  getActiveTrackingSession: vi.fn().mockResolvedValue(null),
  endTrackingSession: vi.fn().mockResolvedValue({ session: {}, justEnded: false }),
  recordExecutiveSignedOut: vi.fn().mockResolvedValue({ ok: true }),
  recordTrackingHeartbeat: vi.fn().mockResolvedValue({ ok: true }),
  insertTrackingPoints: vi.fn().mockResolvedValue({ inserted: 0 }),
}));
const jh = (r: Parameters<typeof headers>[0] = "se") => ({ ...headers(r), "content-type": "application/json" });
beforeEach(() => { vi.resetModules(); installAuth(); });
const app = () => import("../index").then((m) => m.default);
describe("tracking-sessions edge cases", () => {
  it("POST /start — 422 on a bad odometer", async () => {
    const res = await (await app()).request("/api/v1/tracking-sessions/start", { method: "POST", headers: jh(), body: JSON.stringify({ clientSessionId: "cs1", startOdometer: -5 }) }, ENV);
    expect(res.status).toBe(422);
  });
  it("POST /start — accepts a valid whole-km odometer", async () => {
    const res = await (await app()).request("/api/v1/tracking-sessions/start", { method: "POST", headers: jh(), body: JSON.stringify({ clientSessionId: "cs1", startOdometer: 100 }) }, ENV);
    expect(res.status).toBe(201);
  });
  it("POST /signed-out", async () => {
    expect((await (await app()).request("/api/v1/tracking-sessions/signed-out", { method: "POST", headers: jh("logistics"), body: "{}" }, ENV)).status).toBe(200);
  });
  it("POST /:id/points/batch — 422 non-array and 422 non-object element", async () => {
    expect((await (await app()).request("/api/v1/tracking-sessions/s1/points/batch", { method: "POST", headers: jh(), body: JSON.stringify({ points: "x" }) }, ENV)).status).toBe(422);
    expect((await (await app()).request("/api/v1/tracking-sessions/s1/points/batch", { method: "POST", headers: jh(), body: JSON.stringify({ points: [123] }) }, ENV)).status).toBe(422);
  });
});
