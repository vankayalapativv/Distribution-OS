import { Hono } from "hono";
import { success } from "../lib/api-response";
import { ApiError } from "../lib/api-error";
import { requireAuth, requireRole } from "../lib/authz";
import { getSqlClient } from "../lib/db";
import { isAcceptablePassword, PASSWORD_RULE_MESSAGE } from "../lib/password-policy";
import { optionalString, readJsonObject, requiredString } from "../lib/request-body";
import { neonChangePassword, neonSignIn, neonSignOut } from "../services/mobile-auth";
import {
  clearNotifications,
  deleteNotification,
  listMyNotifications,
  markNotificationRead,
  registerPushToken,
} from "../services/invoices";
import { getBadgeCounts } from "../services/badges";
import { actorOf, logAudit } from "../services/audit";
import { listMyAssignedTasks, markMyTaskDone } from "../services/tasks";
import { countSectionUpdates, markSectionSeen } from "../services/section-seen";
import { effectivePermissionsForRole } from "../services/permissions";
import { getMyProfile, updateMyProfile } from "../services/me-profile";
import type { ApiEnv } from "../types";

const OFFICE_ROLES = ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"] as const;

export const meRoutes = new Hono<ApiEnv>()
  .get("/me", async (c) => {
    // Effective permissions let the web gate nav + pages (server still enforces).
    const permissions = await effectivePermissionsForRole(getSqlClient(c), c.var.auth.role);
    return c.json(success(c, { auth: c.var.auth, permissions }));
  })
  .get("/me/profile", async (c) => {
    const auth = requireAuth(c);
    return c.json(success(c, await getMyProfile(getSqlClient(c), auth.userId!)));
  })
  .patch("/me/profile", async (c) => {
    const auth = requireAuth(c);
    const body = await readJsonObject(c);
    const sql = getSqlClient(c);

    const profile = await updateMyProfile(sql, auth.userId!, {
      name: optionalString(body, "name"),
      phone: optionalString(body, "phone"),
    });

    await logAudit(sql, actorOf(auth), {
      action: "user.profile_update",
      entityType: "user",
      entityId: profile.id,
      entityLabel: profile.name,
      summary: "Updated own profile",
    });

    return c.json(success(c, profile));
  })
  .post("/me/change-password", async (c) => {
    const auth = requireAuth(c);
    const body = await readJsonObject(c);
    const currentPassword = requiredString(body, "currentPassword");
    const newPassword = requiredString(body, "newPassword");
    if (!isAcceptablePassword(newPassword)) {
      throw new ApiError("INVALID_FIELD", PASSWORD_RULE_MESSAGE, 422);
    }

    const sql = getSqlClient(c);
    const profile = await getMyProfile(sql, auth.userId!);
    if (!profile.email) {
      throw new ApiError("NO_EMAIL", "This account has no email to change the password for.", 409);
    }

    // Email + password are owned by Neon Auth (Better Auth), not our DB. Verify
    // the current password by signing in with it (this also yields a throwaway
    // session we use to run the change), then swap the password, then sign that
    // throwaway session out. The user's real app session is a DIFFERENT session
    // and `neonChangePassword` leaves other sessions alone, so they stay logged in.
    const signIn = await neonSignIn(c.env, profile.email, currentPassword);
    if (!signIn.ok) {
      if (signIn.status === 401) {
        throw new ApiError("UNAUTHORIZED", "Your current password is incorrect.", 401);
      }
      throw new ApiError("AUTH_UNAVAILABLE", signIn.error, 503);
    }

    const changed = await neonChangePassword(c.env, signIn.session, currentPassword, newPassword);
    await neonSignOut(c.env, signIn.session); // best-effort cleanup of the throwaway session
    if (!changed.ok) {
      const bad = changed.status === 400;
      throw new ApiError(bad ? "INVALID_FIELD" : "AUTH_UNAVAILABLE", changed.error, bad ? 400 : 503);
    }

    await logAudit(sql, actorOf(auth), {
      action: "user.password_change",
      entityType: "user",
      entityId: profile.id,
      entityLabel: profile.name,
      summary: "Changed own password",
    });

    return c.json(success(c, { ok: true }));
  })
  .post("/me/push-token", async (c) => {
    const auth = requireAuth(c);
    const body = await readJsonObject(c);
    const token = requiredString(body, "token");
    const platform = optionalString(body, "platform");
    const result = await registerPushToken(
      getSqlClient(c),
      { userId: auth.userId! },
      token,
      platform,
      { manufacturer: optionalString(body, "manufacturer"), model: optionalString(body, "model") },
    );
    return c.json(success(c, result));
  })
  .get("/me/notifications", async (c) => {
    const auth = requireAuth(c);
    const notifications = await listMyNotifications(getSqlClient(c), {
      userId: auth.userId!,
    });
    return c.json(success(c, { notifications }));
  })
  .post("/me/notifications/:id/read", async (c) => {
    const auth = requireAuth(c);
    const result = await markNotificationRead(
      getSqlClient(c),
      { userId: auth.userId! },
      c.req.param("id"),
    );
    return c.json(success(c, result));
  })
  // Clear the whole feed — registered before /:id so "notifications" alone matches.
  .delete("/me/notifications", async (c) => {
    const auth = requireAuth(c);
    const result = await clearNotifications(getSqlClient(c), { userId: auth.userId! });
    return c.json(success(c, result));
  })
  .delete("/me/notifications/:id", async (c) => {
    const auth = requireAuth(c);
    const result = await deleteNotification(
      getSqlClient(c),
      { userId: auth.userId! },
      c.req.param("id"),
    );
    return c.json(success(c, result));
  })
  // Sales-Executive: tasks the office assigned to them (mobile Reminders tab).
  .get("/me/tasks", async (c) => {
    const auth = requireRole(c, ["SALES_EXECUTIVE"]);
    const tasks = await listMyAssignedTasks(getSqlClient(c), { userId: auth.userId! });
    return c.json(success(c, { tasks }));
  })
  .post("/me/tasks/:id/done", async (c) => {
    const auth = requireRole(c, ["SALES_EXECUTIVE"]);
    const result = await markMyTaskDone(
      getSqlClient(c),
      { userId: auth.userId! },
      c.req.param("id"),
    );
    return c.json(success(c, result));
  })
  // Office: mark an Orders/Collections page as seen (clears its sidebar badge).
  .post("/me/section-seen", async (c) => {
    const auth = requireRole(c, [...OFFICE_ROLES]);
    const body = await readJsonObject(c);
    const section = requiredString(body, "section");
    const result = await markSectionSeen(getSqlClient(c), auth.userId!, section);
    return c.json(success(c, result));
  })
  // Office: count items created since a timestamp — the in-page "N new" banner.
  .get("/me/section-updates", async (c) => {
    const auth = requireRole(c, [...OFFICE_ROLES]);
    const { section, since } = c.req.query();
    const count = await countSectionUpdates(getSqlClient(c), section ?? "", since ?? "");
    return c.json(success(c, { count }));
  })
  .get("/me/badge-counts", async (c) => {
    const auth = requireAuth(c);
    const counts = await getBadgeCounts(getSqlClient(c), {
      userId: auth.userId!,
      role: auth.role,
    });
    return c.json(success(c, counts));
  })
  .get("/me/permissions", (c) => {
    return c.json(success(c, { role: c.var.auth.role, permissions: [], configured: false }));
  })
  .get("/me/scope", (c) => {
    return c.json(success(c, {
      role: c.var.auth.role,
      teams: [],
      territories: [],
      customers: [],
      configured: false,
    }));
  });
