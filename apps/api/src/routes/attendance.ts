import { Hono } from "hono";
import { success } from "../lib/api-response";
import { requireRole } from "../lib/authz";
import { getSqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";
import {
  assertDate,
  assertMonth,
  assertStatus,
  clearAttendance,
  getAttendanceGrid,
  getDailyAttendance,
  getMonthlyAttendance,
  setAttendance,
  setHolidayForAllSes,
  thisMonthIst,
  todayIst,
} from "../services/attendance";
import { optionalString, readJsonObject, requiredString } from "../lib/request-body";
import { actorOf, logAudit } from "../services/audit";
import type { ApiEnv } from "../types";

/** SE attendance is a supervision view for the office roles. */
const ATTENDANCE_ROLES = ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"] as const;

export const attendanceRoutes = new Hono<ApiEnv>()
  // Daily roll-call: all active SEs for a date, with their start-day time.
  .get("/daily", async (c) => {
    requireRole(c, [...ATTENDANCE_ROLES]);
    const date = assertDate(c.req.query("date") ?? todayIst());
    const rows = await getDailyAttendance(getSqlClient(c), date);
    const present = rows.filter((r) => r.present).length;
    return c.json(
      success(c, { date, rows, summary: { total: rows.length, present, absent: rows.length - present } }),
    );
  })

  // Per-SE month view: one entry per day the SE started their day.
  .get("/monthly", async (c) => {
    requireRole(c, [...ATTENDANCE_ROLES]);
    const userId = c.req.query("userId");
    if (!userId) throw new ApiError("INVALID_FIELD", "userId is required.", 422);
    const month = assertMonth(c.req.query("month") ?? thisMonthIst());
    const days = await getMonthlyAttendance(getSqlClient(c), userId, month);
    return c.json(success(c, { userId, month, days }));
  })

  // Editable monthly grid: every active SE × each day, effective status
  // (manual override wins, else derived from tracking). Office roles may view.
  .get("/grid", async (c) => {
    requireRole(c, [...ATTENDANCE_ROLES]);
    const month = assertMonth(c.req.query("month") ?? thisMonthIst());
    const data = await getAttendanceGrid(getSqlClient(c), month);
    return c.json(success(c, data));
  })

  // Set/override one SE's status for a day — SUPER_ADMIN only.
  .put("/", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN"]);
    const body = await readJsonObject(c);
    const userId = requiredString(body, "userId");
    const date = assertDate(requiredString(body, "date"));
    const status = assertStatus(requiredString(body, "status"));
    const note = optionalString(body, "note");
    const sql = getSqlClient(c);
    await setAttendance(sql, {
      userId,
      date,
      status,
      note: note?.trim() ? note.trim() : null,
      updatedBy: auth.userId!,
    });
    await logAudit(sql, actorOf(auth), {
      action: "attendance.set",
      entityType: "attendance",
      entityId: userId,
      summary: `Set attendance to ${status} for ${date}`,
      metadata: { userId, date, status, note: note ?? null },
    });
    return c.json(success(c, { userId, date, status }));
  })

  // Mark a date a company-wide holiday for every active SE — SUPER_ADMIN only.
  .post("/holiday-all", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN"]);
    const body = await readJsonObject(c);
    const date = assertDate(requiredString(body, "date"));
    const note = optionalString(body, "note");
    const sql = getSqlClient(c);
    const count = await setHolidayForAllSes(sql, {
      date,
      note: note?.trim() ? note.trim() : null,
      updatedBy: auth.userId!,
    });
    await logAudit(sql, actorOf(auth), {
      action: "attendance.holiday_all",
      entityType: "attendance",
      entityLabel: date,
      summary: `Marked ${date} a holiday for all ${count} SEs`,
      metadata: { date, count, note: note ?? null },
    });
    return c.json(success(c, { date, count }));
  })

  // Clear a manual override (revert to the tracking-derived status) — SA only.
  .delete("/", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN"]);
    const userId = c.req.query("userId");
    const date = c.req.query("date");
    if (!userId || !date) throw new ApiError("INVALID_FIELD", "userId and date are required.", 422);
    const sql = getSqlClient(c);
    await clearAttendance(sql, userId, assertDate(date));
    await logAudit(sql, actorOf(auth), {
      action: "attendance.clear",
      entityType: "attendance",
      entityId: userId,
      summary: `Cleared attendance override for ${date}`,
      metadata: { userId, date },
    });
    return c.json(success(c, { userId, date }));
  });
