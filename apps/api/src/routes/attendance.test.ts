import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, headers, installAuth } from "../test/route-harness";

vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => ({})) };
});
vi.mock("../services/audit", () => ({ actorOf: () => ({}), logAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../services/attendance", () => ({
  assertDate: (v: string) => v,
  assertMonth: (v: string) => v,
  assertStatus: (v: string) => v,
  todayIst: () => "2026-06-15",
  thisMonthIst: () => "2026-06",
  getDailyAttendance: vi.fn().mockResolvedValue([{ present: true }, { present: false }]),
  getMonthlyAttendance: vi.fn().mockResolvedValue([]),
  getAttendanceGrid: vi.fn().mockResolvedValue({ rows: [] }),
  setAttendance: vi.fn().mockResolvedValue(undefined),
  clearAttendance: vi.fn().mockResolvedValue(undefined),
}));

const jh = () => ({ ...headers("superAdmin"), "content-type": "application/json" });
beforeEach(() => { vi.resetModules(); installAuth(); });
const app = () => import("../index").then((m) => m.default);

describe("attendance routes", () => {
  it("GET /daily computes present/absent summary", async () => {
    const res = await (await app()).request("/api/v1/attendance/daily", { headers: headers("manager") }, ENV);
    expect((await res.json()).data.summary).toMatchObject({ total: 2, present: 1, absent: 1 });
  });
  it("GET /monthly — 422 without userId, 200 with", async () => {
    expect((await (await app()).request("/api/v1/attendance/monthly", { headers: headers("manager") }, ENV)).status).toBe(422);
    expect((await (await app()).request("/api/v1/attendance/monthly?userId=se-1&month=2026-06", { headers: headers("manager") }, ENV)).status).toBe(200);
  });
  it("GET /grid", async () => {
    expect((await (await app()).request("/api/v1/attendance/grid", { headers: headers("accountant") }, ENV)).status).toBe(200);
  });
  it("PUT / sets an override (SUPER_ADMIN, with note)", async () => {
    const res = await (await app()).request("/api/v1/attendance", { method: "PUT", headers: jh(), body: JSON.stringify({ userId: "se-1", date: "2026-06-10", status: "present", note: "manual" }) }, ENV);
    expect(res.status).toBe(200);
  });
  it("DELETE / — 422 without params, 200 with", async () => {
    expect((await (await app()).request("/api/v1/attendance", { method: "DELETE", headers: headers("superAdmin") }, ENV)).status).toBe(422);
    expect((await (await app()).request("/api/v1/attendance?userId=se-1&date=2026-06-10", { method: "DELETE", headers: headers("superAdmin") }, ENV)).status).toBe(200);
  });
});
