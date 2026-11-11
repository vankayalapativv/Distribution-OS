import { Hono } from "hono";
import { z } from "zod";
import { success } from "../lib/api-response";
import { requireAuth, requireRole } from "../lib/authz";
import { getSqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";
import { readJsonObject } from "../lib/request-body";
import { validate } from "../lib/validate";
import {
  deleteWebPushSubscription,
  saveWebPushSubscription,
  vapidFromEnv,
} from "../services/web-push-notify";
import type { ApiEnv } from "../types";

const OFFICE = ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"] as const;

// Boundary schema (audit G-0602): standard PushSubscription.toJSON() shape.
const SubscribeSchema = z.object({
  endpoint: z.string().min(1),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

/** Browser Web Push: the VAPID public key + subscribe/unsubscribe for office users. */
export const webPushRoutes = new Hono<ApiEnv>()
  // The client needs the VAPID public key to create a PushSubscription. Returns
  // null when Web Push isn't configured — the client then simply skips it.
  .get("/public-key", (c) => {
    requireAuth(c);
    const vapid = vapidFromEnv(c.env);
    return c.json(success(c, { publicKey: vapid?.publicKey ?? null }));
  })
  // Store (or refresh) this browser's subscription. Accepts the standard
  // PushSubscription.toJSON() shape: { endpoint, keys: { p256dh, auth } }.
  .post("/subscribe", async (c) => {
    const auth = requireRole(c, [...OFFICE]);
    const { endpoint, keys } = validate(SubscribeSchema, await readJsonObject(c));
    await saveWebPushSubscription(getSqlClient(c), auth.userId!, {
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    });
    return c.json(success(c, { ok: true }));
  })
  // Remove this browser's subscription (called when the user disables sound).
  .post("/unsubscribe", async (c) => {
    const auth = requireRole(c, [...OFFICE]);
    const body = await readJsonObject(c);
    const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
    if (!endpoint) throw new ApiError("VALIDATION_ERROR", "endpoint is required.", 422);
    await deleteWebPushSubscription(getSqlClient(c), auth.userId!, endpoint);
    return c.json(success(c, { ok: true }));
  });
