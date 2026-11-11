import { afterEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  materializeTodayPlan: vi.fn().mockResolvedValue("bp-1"),
  createCheckoutFollowup: vi.fn().mockResolvedValue(undefined),
  trackingCutoffHour: vi.fn().mockReturnValue(24),
}));
vi.mock("./beat-materialize", () => ({ materializeTodayPlan: h.materializeTodayPlan }));
vi.mock("./followups", () => ({ createCheckoutFollowup: h.createCheckoutFollowup }));
vi.mock("./tracking-sessions", () => ({ trackingCutoffHour: h.trackingCutoffHour }));

import { autoCloseStaleVisits, checkIn } from "./visits";
import { makeSql } from "../test/sql-mock";

const ctx = (over = {}) => ({ userId: "se-1", customerId: "c1", latitude: 17.4, longitude: 78.4, clientUuid: null, ...over });

afterEach(() => vi.clearAllMocks());

describe("checkIn", () => {
  it("409s a re-check-in once already checked out", async () => {
    const sql = makeSql({ get_visit_by_client_uuid: [{ id: "v1", visitCode: "V1", checkInTime: "t", checkedOut: true }] });
    await expect(checkIn(sql, ctx({ clientUuid: "u1" }) as never)).rejects.toMatchObject({ status: 409 });
  });

  it("returns the existing open visit on an idempotent re-check-in", async () => {
    const sql = makeSql({ get_visit_by_client_uuid: [{ id: "v1", visitCode: "V1", checkInTime: "t", checkedOut: false }] });
    expect(await checkIn(sql, ctx({ clientUuid: "u1" }) as never)).toMatchObject({ visitId: "v1", existing: true });
  });

  it("blocks a check-in while another visit is open (OPEN_VISIT 409)", async () => {
    const sql = makeSql({
      get_customer_exists: [{ id: "c1" }],
      checkin_open_visit_guard: [{ customerId: "other", name: "Other Shop" }],
    });
    await expect(checkIn(sql, ctx() as never)).rejects.toMatchObject({ code: "OPEN_VISIT", status: 409 });
  });

  it("records a planned visit: materializes the beat + marks the stop checked-in", async () => {
    const sql = makeSql({
      get_customer_exists: [{ id: "c1" }],
      checkin_open_visit_guard: [],
      checkin_ist_today: [{ weekday: 1, istDate: "2026-06-01" }],
      find_today_beat_stop_for_customer: [{ id: "bps1", beatPlanId: "bp1" }],
      create_visit_from_customer: [{ id: "v1", visitCode: "V1", checkInTime: "2026-06-01T09:00:00Z" }],
    });
    const res = await checkIn(sql, ctx() as never);
    expect(res).toMatchObject({ visitId: "v1", existing: false });
    expect(h.materializeTodayPlan).toHaveBeenCalled();
  });

  it("500s when the insert lost the race and no winner row exists", async () => {
    const sql = makeSql({
      get_visit_by_client_uuid: [], // fast-path miss + race-winner miss
      get_customer_exists: [{ id: "c1" }],
      checkin_open_visit_guard: [],
      checkin_ist_today: [{ weekday: 0, istDate: "2026-06-07" }], // Sunday → skip materialize
      find_today_beat_stop_for_customer: [],
      create_visit_from_customer: [], // insert returned nothing
    });
    await expect(checkIn(sql, ctx({ clientUuid: "u1" }) as never)).rejects.toMatchObject({ status: 500 });
  });
});

describe("autoCloseStaleVisits", () => {
  it("closes prior-day open visits and returns the count", async () => {
    const sql = makeSql({ auto_close_stale_visits: [{ id: "v1" }, { id: "v2" }] });
    expect(await autoCloseStaleVisits(sql)).toEqual({ closed: 2 });
  });
});
