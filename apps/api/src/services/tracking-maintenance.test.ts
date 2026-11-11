import { afterEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  recalculateTrackingSessionDistance: vi.fn().mockResolvedValue(undefined),
  recalculateTrackingSessionDwell: vi.fn().mockResolvedValue(undefined),
  notifyAdminsOfDayEvent: vi.fn().mockRejectedValue(new Error("push down")), // forces the .catch
}));
vi.mock("./tracking-distance", () => ({ recalculateTrackingSessionDistance: h.recalculateTrackingSessionDistance }));
vi.mock("./tracking-dwell", () => ({ recalculateTrackingSessionDwell: h.recalculateTrackingSessionDwell }));
vi.mock("./admin-notify", () => ({ notifyAdminsOfDayEvent: h.notifyAdminsOfDayEvent }));

import { capExpiredSeSessions } from "./tracking-maintenance";
import { makeSql } from "../test/sql-mock";

afterEach(() => vi.clearAllMocks());

describe("capExpiredSeSessions", () => {
  it("closes expired sessions and recalcs each (swallowing a failed admin push)", async () => {
    const sql = makeSql({ cap_expired_se_tracking_sessions: [{ id: "s1", userId: "u1" }] });
    const res = await capExpiredSeSessions(sql, { now: "2026-06-02T00:00:00Z" });
    expect(res).toEqual({ closedSessions: 1 });
    expect(h.recalculateTrackingSessionDistance).toHaveBeenCalledWith(sql, "s1");
    expect(h.notifyAdminsOfDayEvent).toHaveBeenCalled();
  });
});

import { runTrackingMaintenance } from "./tracking-maintenance";

describe("runTrackingMaintenance", () => {
  it("caps expired sessions and raises interruption alerts for stale ones", async () => {
    const sql = makeSql({
      cap_expired_se_tracking_sessions: [],
      find_stale_tracking_sessions: [
        { sessionId: "s1", userId: "u1", executiveName: "Asha", lastHeartbeatAt: "2026-06-01T09:00:00Z", lastRecordedAt: "2026-06-01T08:55:00Z" },
        { sessionId: "s2", userId: "u2", executiveName: null, lastHeartbeatAt: null, lastRecordedAt: null }, // → formatIstTime(null) path
      ],
      upsert_tracking_interruption_alerts: [{ id: "al1" }, { id: "al2" }],
    });
    const res = await runTrackingMaintenance(sql, { now: "2026-06-01T10:00:00Z", staleAfterMinutes: 15 });
    expect(res).toEqual({ closedSessions: 0, interruptionAlerts: 2 });
  });
});
