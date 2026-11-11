import { describe, expect, it } from "vitest";
import { endTrackingSession, getActiveTrackingSession, insertTrackingPoints, isAfterAllowedEndTime, recordExecutiveSignedOut, startTrackingSession, trackingCutoffHour } from "./tracking-sessions";
import { makeSql, calledTag } from "../test/sql-mock";

const SESSION = { id: "s1", clientSessionId: "cs1", userId: "u1", deviceId: "d1", sessionDate: "2026-06-01", startedAt: "t", endedAt: null, status: "active", startOdometer: null, endOdometer: null };
const conflict = () => Object.assign(new Error("dup"), { code: "23505", constraint: "gps_tracking_sessions_one_active_per_user_device" });

describe("pure helpers", () => {
  it("trackingCutoffHour + isAfterAllowedEndTime", () => {
    expect(trackingCutoffHour("SALES_EXECUTIVE")).toBe(24);
    expect(trackingCutoffHour("LOGISTICS")).toBeNull();
    expect(isAfterAllowedEndTime({ recordedAt: "2026-06-02T10:00:00+05:30", sessionDate: "2026-06-01", timezone: "Asia/Kolkata", cutoffHour: 24 })).toBe(true);
    expect(isAfterAllowedEndTime({ recordedAt: "x", sessionDate: "2026-06-01", timezone: "Asia/Kolkata", cutoffHour: null })).toBe(false);
  });
});

describe("getActiveTrackingSession", () => {
  it("maps or null", async () => {
    expect(await getActiveTrackingSession(makeSql({ get_active_tracking_session: [SESSION] }), "u1")).toMatchObject({ trackingSessionId: "s1" });
    expect(await getActiveTrackingSession(makeSql({ get_active_tracking_session: [] }), "u1")).toBeNull();
  });
});

describe("startTrackingSession", () => {
  const input = (over = {}) => ({ userId: "u1", clientSessionId: "cs1", deviceId: "d1", ...over });
  it("reuses the live session / replays by clientSessionId", async () => {
    expect(await startTrackingSession(makeSql({ get_active_tracking_session: [SESSION], backfill_start_odometer: [] }), input({ startOdometer: 1000 }))).toMatchObject({ existing: true });
    expect(await startTrackingSession(makeSql({ get_active_tracking_session: [], get_tracking_session_by_client_session_id: [SESSION], backfill_start_odometer: [] }), input())).toMatchObject({ existing: true });
  });
  it("blocks an SE who already ended their day (422)", async () => {
    const sql = makeSql({ get_active_tracking_session: [], get_tracking_session_by_client_session_id: [], se_manual_ended_today: [{ found: 1 }] });
    await expect(startTrackingSession(sql, input({ role: "SALES_EXECUTIVE" }))).rejects.toMatchObject({ code: "DAY_ENDED", status: 422 });
  });
  it("creates a fresh session", async () => {
    const sql = makeSql({ get_active_tracking_session: [], get_tracking_session_by_client_session_id: [], create_tracking_session: [SESSION] });
    expect(await startTrackingSession(sql, input())).toMatchObject({ existing: false });
  });
  it("500s when the insert does nothing and no winner exists", async () => {
    const sql = makeSql({ get_active_tracking_session: [], get_tracking_session_by_client_session_id: [], create_tracking_session: [] });
    await expect(startTrackingSession(sql, input())).rejects.toMatchObject({ status: 500 });
  });
  it("recovers the one-active-session race winner, else rethrows", async () => {
    let n = 0;
    const win = makeSql({ get_active_tracking_session: () => (n++ === 0 ? [] : [SESSION]), get_tracking_session_by_client_session_id: [], create_tracking_session: () => { throw conflict(); } });
    expect(await startTrackingSession(win, input())).toMatchObject({ existing: true });
    const rethrowConflict = makeSql({ get_active_tracking_session: [], get_tracking_session_by_client_session_id: [], create_tracking_session: () => { throw conflict(); } });
    await expect(startTrackingSession(rethrowConflict, input())).rejects.toMatchObject({ code: "23505" });
    const other = makeSql({ get_active_tracking_session: [], get_tracking_session_by_client_session_id: [], create_tracking_session: () => { throw new Error("db boom"); } });
    await expect(startTrackingSession(other, input())).rejects.toThrow("db boom");
  });
});

describe("insertTrackingPoints", () => {
  const sess = { get_tracking_session_for_points: [{ id: "s1", userId: "u1", sessionDate: "2026-06-01", timezone: "Asia/Kolkata", status: "active" }] };
  it("404s a missing session", async () => {
    await expect(insertTrackingPoints(makeSql({ get_tracking_session_for_points: [] }), { userId: "u1", trackingSessionId: "s1", points: [] })).rejects.toMatchObject({ status: 404 });
  });
  it("rejects out-of-range coordinates", async () => {
    const res = await insertTrackingPoints(makeSql(sess), { userId: "u1", trackingSessionId: "s1", points: [{ locationPointId: "p1", latitude: 200, longitude: 0, accuracy: null, batteryPercentage: null, recordedAt: "2026-06-01T09:00:00Z" } as never] });
    expect(res.results[0]).toMatchObject({ status: "rejected", reason: "INVALID_COORDINATES" });
  });
  it("422s an invalid recordedAt (SE cutoff path)", async () => {
    await expect(insertTrackingPoints(makeSql(sess), { userId: "u1", trackingSessionId: "s1", role: "SALES_EXECUTIVE", points: [{ locationPointId: "p1", latitude: 17.4, longitude: 78.4, accuracy: null, batteryPercentage: null, recordedAt: "not-a-date" } as never] })).rejects.toMatchObject({ status: 422 });
  });
});

describe("endTrackingSession", () => {
  const odo = { end_tracking_session_start_odo: [{ startOdometer: 100 }] };
  const row = { end_tracking_session: [{ id: "s1", clientSessionId: "cs1", userId: "u1", deviceId: "d1", sessionDate: "2026-06-01", startedAt: "t", endedAt: "t2", status: "ended" }] };
  it("enforces odometer guards (too low / distance too low / too high)", async () => {
    await expect(endTrackingSession(makeSql(odo), { userId: "u1", trackingSessionId: "s1", endOdometer: 50 })).rejects.toMatchObject({ code: "END_ODOMETER_TOO_LOW" });
    await expect(endTrackingSession(makeSql(odo), { userId: "u1", trackingSessionId: "s1", endOdometer: 105 })).rejects.toMatchObject({ code: "ODOMETER_DISTANCE_TOO_LOW" });
    await expect(endTrackingSession(makeSql(odo), { userId: "u1", trackingSessionId: "s1", endOdometer: 500 })).rejects.toMatchObject({ code: "ODOMETER_DISTANCE_TOO_HIGH" });
  });
  it("ends the day with a valid reading", async () => {
    const sql = makeSql({ ...odo, ...row });
    expect(await endTrackingSession(sql, { userId: "u1", trackingSessionId: "s1", endOdometer: 150 })).toMatchObject({ session: { status: "ended" } });
  });
});

describe("recordExecutiveSignedOut", () => {
  it("stamps the signed-out time", async () => {
    const sql = makeSql();
    expect(await recordExecutiveSignedOut(sql, { userId: "u1" })).toEqual({ ok: true });
    expect(calledTag(sql, "stamp_executive_signed_out")).toBe(true);
  });
});
