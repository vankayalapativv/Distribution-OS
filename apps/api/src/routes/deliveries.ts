import type { R2Bucket } from "@cloudflare/workers-types";
import { waitUntilSafe } from "../lib/wait-until";
import { Hono } from "hono";
import { success } from "../lib/api-response";
import { requireRole } from "../lib/authz";
import { actorOf, logAudit } from "../services/audit";
import { getSqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";
import { readJsonObject, requiredString, optionalString, optionalNumber } from "../lib/request-body";
import { photoGeoFromForm } from "../lib/geocode";
import {
  startRun,
  endRun,
  addStop,
  deliverableInvoices,
  uploadDeliveryPhoto,
  getActiveRun,
} from "../services/deliveries";
import { sendExpoPush } from "../services/invoices";
import type { ApiEnv } from "../types";

const DELIVERY_ROLES = ["LOGISTICS", "SUPER_ADMIN"] as const;

function requireBucket(bucket: R2Bucket | undefined): R2Bucket {
  if (!bucket) throw new ApiError("CONFIG", "Photo storage is not configured.", 500);
  return bucket;
}

export const deliveriesRoutes = new Hono<ApiEnv>()

  .get("/runs/active", async (c) => {
    const auth = requireRole(c, [...DELIVERY_ROLES]);
    const data = await getActiveRun(getSqlClient(c), { userId: auth.userId! });
    return c.json(success(c, data));
  })

  .post("/runs/start", async (c) => {
    const auth = requireRole(c, [...DELIVERY_ROLES]);
    const body = await readJsonObject(c);
    const sql = getSqlClient(c);
    const vehicleNumber = requiredString(body, "vehicleNumber");
    const run = await startRun(sql, { userId: auth.userId! }, {
      vehicleNumber,
      startOdometer: optionalNumber(body, "startOdometer") ?? null,
      clientUuid: optionalString(body, "clientUuid"),
    });
    if (!run.existing) {
      await logAudit(sql, actorOf(auth), {
        action: "delivery_run.start",
        entityType: "delivery_run",
        entityId: run.id,
        entityLabel: vehicleNumber,
        summary: `Started a delivery run (${vehicleNumber})`,
      });
    }
    return c.json(success(c, run), run.existing ? 200 : 201);
  })

  .post("/runs/:id/end", async (c) => {
    const auth = requireRole(c, [...DELIVERY_ROLES]);
    const body = await readJsonObject(c);
    const sql = getSqlClient(c);
    const run = await endRun(
      sql,
      { userId: auth.userId! },
      c.req.param("id"),
      optionalNumber(body, "endOdometer") ?? null,
    );
    await logAudit(sql, actorOf(auth), {
      action: "delivery_run.end",
      entityType: "delivery_run",
      entityId: c.req.param("id"),
      summary: "Ended a delivery run",
    });
    return c.json(success(c, run));
  })

  .post("/runs/:id/stops", async (c) => {
    const auth = requireRole(c, [...DELIVERY_ROLES]);
    const body = await readJsonObject(c);
    const sql = getSqlClient(c);
    const stop = await addStop(sql, { userId: auth.userId! }, c.req.param("id"), {
      customerId: requiredString(body, "customerId"),
      latitude: optionalNumber(body, "latitude") ?? null,
      longitude: optionalNumber(body, "longitude") ?? null,
      clientUuid: optionalString(body, "clientUuid"),
      invoiceId: optionalString(body, "invoiceId"),
    });
    if (!stop.existing) {
      await logAudit(sql, actorOf(auth), {
        action: "delivery.stop",
        entityType: "delivery_run",
        entityId: c.req.param("id"),
        summary: "Marked a delivery as delivered",
      });
    }
    // Best-effort "order delivered" push to the customer's SE — never delays
    // the delivery response.
    if (stop.push) {
      waitUntilSafe(c, 
        sendExpoPush(stop.push.tokens, stop.push.title, stop.push.body, { type: "delivery" }),
      );
    }
    return c.json(success(c, stop), stop.existing ? 200 : 201);
  })

  // Deliverable invoices (order-linked, not yet delivered). Omit customerId for
  // the global logistics list; pass it to scope to one customer.
  .get("/pending-invoices", async (c) => {
    requireRole(c, [...DELIVERY_ROLES]);
    const customerId = c.req.query("customerId") ?? null;
    const invoices = await deliverableInvoices(getSqlClient(c), customerId);
    return c.json(success(c, { invoices }));
  })

  .post("/runs/:id/photos", async (c) => {
    const auth = requireRole(c, [...DELIVERY_ROLES]);
    const bucket = requireBucket(c.env.PHOTOS);
    const form = await c.req.formData().catch(() => null);
    const file = form?.get("photo");
    if (!(file instanceof File) || file.size === 0) {
      throw new ApiError("INVALID_FIELD", "Attach the image as the 'photo' form field.", 422);
    }
    const kindField = form?.get("kind");
    const stopField = form?.get("stopId");
    const geo = await photoGeoFromForm(c.env.GOOGLE_GEOCODING_API_KEY, form);
    const kind = typeof kindField === "string" ? kindField : "delivery";
    const sql = getSqlClient(c);
    const photo = await uploadDeliveryPhoto(
      sql,
      bucket,
      { userId: auth.userId! },
      c.req.param("id"),
      {
        kind,
        stopId: typeof stopField === "string" && stopField.length > 0 ? stopField : null,
        file,
        geo,
      },
    );
    await logAudit(sql, actorOf(auth), {
      action: "delivery.photo",
      entityType: "delivery_run",
      entityId: c.req.param("id"),
      summary: `Uploaded a delivery photo (${kind})`,
      metadata: { kind },
    });
    return c.json(success(c, photo), 201);
  });
