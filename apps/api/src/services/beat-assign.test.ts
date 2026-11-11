import { describe, expect, it } from "vitest";
import { assignCustomerToDay, enrollCustomerInTodayBeat, reorderBeatDay, unassignCustomer } from "./beat-assign";
import { makeSql, calledTag } from "../test/sql-mock";

describe("beat-assign", () => {
  it("assignCustomerToDay: invalid weekday 422, non-SE owner 422, happy", async () => {
    await expect(assignCustomerToDay(makeSql(), "c1", 9)).rejects.toMatchObject({ status: 422 });
    await expect(assignCustomerToDay(makeSql({ beat_assign_owner: [{ executiveId: "u1", role: "MANAGER" }] }), "c1", 1)).rejects.toMatchObject({ status: 422 });
    const sql = makeSql({ beat_assign_owner: [{ executiveId: "se-1", role: "SALES_EXECUTIVE" }], assign_customer_to_beat_day: [] });
    expect(await assignCustomerToDay(sql, "c1", 2)).toEqual({ customerId: "c1", weekday: 2 });
  });
  it("reorderBeatDay: invalid weekday 422, empty → count 0, happy", async () => {
    await expect(reorderBeatDay(makeSql(), "se-1", 0, ["c1"])).rejects.toMatchObject({ status: 422 });
    expect(await reorderBeatDay(makeSql(), "se-1", 1, [])).toEqual({ weekday: 1, count: 0 });
    const sql = makeSql({ reorder_beat_day: [] });
    expect(await reorderBeatDay(sql, "se-1", 1, ["c1", "c2"])).toEqual({ weekday: 1, count: 2 });
  });
  it("unassignCustomer deletes the beat row", async () => {
    const sql = makeSql();
    expect(await unassignCustomer(sql, "c1")).toEqual({ customerId: "c1" });
    expect(calledTag(sql, "unassign_customer_beat")).toBe(true);
  });
  it("enrollCustomerInTodayBeat inserts for the IST weekday", async () => {
    const sql = makeSql({ enroll_weekday_ist: [{ weekday: 3 }], enroll_customer_today_beat: [] });
    await enrollCustomerInTodayBeat(sql, "se-1", "c1");
    expect(calledTag(sql, "enroll_customer_today_beat")).toBe(true);
  });
});
