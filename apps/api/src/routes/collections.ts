import type { R2Bucket } from "@cloudflare/workers-types";
import { waitUntilSafe } from "../lib/wait-until";
import { Hono } from "hono";
import { success } from "../lib/api-response";
import { requireAuth, requireCapability, requireRole } from "../lib/authz";
import { actorOf, logAudit } from "../services/audit";
import { getSqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";
import { readJsonObject, requiredString, optionalString, optionalNumber } from "../lib/request-body";
import {
  listCollections,
  listCollectionsPaged,
  getCollectionById,
  createCollection,
  updateCollection,
  listCollectors,
  verifyCollection,
  rejectCollection,
  VALID_PAYMENT_MODES,
  VALID_COLLECTION_TYPES,
} from "../services/collections";
import { getCollectionProof, uploadCollectionProof } from "../services/collection-proofs";
import { photoGeoFromForm } from "../lib/geocode";
import { assertCustomerVisible } from "../services/customers";
import { customerName, executiveFirstName, inr, notifyOfficeWebPush, vapidFromEnv } from "../services/web-push-notify";
import { notifyAdmins } from "../services/admin-notify";
import { collectionBody } from "../services/notify-format";
import type { ApiEnv } from "../types";

function requireBucket(bucket: R2Bucket | undefined): R2Bucket {
  if (!bucket) {
    throw new ApiError("CONFIG", "Photo storage is not configured.", 500);
  }
  return bucket;
}

/** Validate + normalise the create-collection body. ACCOUNTANT may create only
 *  credit notes here (they verify cash collections, not create them). Throws on
 *  any invalid field; returns the core validated values. */
function parseCreateCollectionBody(body: Record<string, unknown>, role: string | null) {
  const customerId = requiredString(body, "customerId");
  const collectionDate = requiredString(body, "collectionDate");
  const paymentMode = requiredString(body, "paymentMode");

  if (!VALID_PAYMENT_MODES.has(paymentMode)) {
    throw new ApiError(
      "VALIDATION_ERROR",
      `paymentMode must be one of: ${[...VALID_PAYMENT_MODES].join(", ")}`,
      422,
    );
  }

  if (role === "ACCOUNTANT" && paymentMode !== "credit_note") {
    throw new ApiError("FORBIDDEN", "Accountants can only create credit notes.", 403);
  }

  // Optional for back-compat (older app builds omit it) — defaults to general.
  const collectionType = optionalString(body, "collectionType") ?? "general";
  if (!VALID_COLLECTION_TYPES.has(collectionType)) {
    throw new ApiError(
      "VALIDATION_ERROR",
      `collectionType must be one of: ${[...VALID_COLLECTION_TYPES].join(", ")}`,
      422,
    );
  }

  const rawAmount = body.collectionAmount;
  if (rawAmount === undefined || rawAmount === null) {
    throw new ApiError("VALIDATION_ERROR", "collectionAmount is required.", 422);
  }
  const collectionAmount = Number(rawAmount);
  if (isNaN(collectionAmount) || collectionAmount <= 0) {
    throw new ApiError("VALIDATION_ERROR", "collectionAmount must be a positive number.", 422);
  }

  return { customerId, collectionDate, paymentMode, collectionType, collectionAmount };
}

export const collectionsRoutes = new Hono<ApiEnv>()

  .get("/", async (c) => {
    const auth = requireAuth(c);
    const sql = getSqlClient(c);
    const url = new URL(c.req.url);
    const customerId = url.searchParams.get("customerId");
    // SE scoping (2026-07-10): a named customer must be theirs; without one,
    // the list is limited to collections they personally recorded (this is
    // what the mobile sync status-pull needs).
    if (auth.role === "SALES_EXECUTIVE" && customerId) {
      await assertCustomerVisible(sql, { userId: auth.userId!, role: auth.role }, customerId);
    }
    const filters = {
      status: url.searchParams.get("status") ?? null,
      customerId,
      fromDate: url.searchParams.get("fromDate") ?? null,
      toDate: url.searchParams.get("toDate") ?? null,
      collectedBy: auth.role === "SALES_EXECUTIVE" && !customerId ? auth.userId : null,
    };
    const collections = await listCollections(sql, { userId: auth.userId! }, filters);
    return c.json(success(c, collections));
  })

  // Paginated/sorted/filtered list for the web table (standard table stack).
  // Office roles; registered before /:id so "paged" is not treated as an id.
  .get("/paged", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"]);
    const q = c.req.query();
    const num = (v: string | undefined) => (v == null || v === "" ? null : Number(v));
    const result = await listCollectionsPaged(
      getSqlClient(c),
      { userId: auth.userId! },
      {
        status: q.status ?? null,
        search: q.search ?? null,
        customerId: q.customerId ?? null,
        collectedBy: q.collectedBy ?? null,
        fromDate: q.fromDate ?? null,
        toDate: q.toDate ?? null,
        sort: q.sort ?? null,
        dir: q.dir ?? null,
        page: num(q.page),
        pageSize: num(q.pageSize),
      },
    );
    return c.json(
      success(c, { collections: result.rows, total: result.total, page: result.page, pageSize: result.pageSize }),
    );
  })

  // Users who can be credited as the collector on a web-recorded collection.
  // Registered before /:id so "collectors" is not treated as a collection id.
  // Office roles that can record a collection (POST /collections allows the same
  // three) need the collectors list — ACCOUNTANT included as of 2026-08-20.
  .get("/collectors", async (c) => {
    requireRole(c, ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"]);
    const collectors = await listCollectors(getSqlClient(c));
    return c.json(success(c, collectors));
  })

  .get("/:id", async (c) => {
    // IDOR fix (2026-10-05): scope the by-id read to the caller's role. A
    // SALES_EXECUTIVE sees a collection only if they collected it or own the
    // customer; office roles see all. Role is passed through to the service.
    const auth = requireAuth(c);
    const sql = getSqlClient(c);
    const collection = await getCollectionById(
      sql,
      { userId: auth.userId!, role: auth.role },
      c.req.param("id"),
    );
    return c.json(success(c, collection));
  })

  .post("/", async (c) => {
    // ACCOUNTANT may create ONLY credit notes here (they verify cash collections,
    // not create them); the guard below enforces that.
    const auth = await requireCapability(c, "action:collections.record", [
      "SUPER_ADMIN",
      "MANAGER",
      "ACCOUNTANT",
      "SALES_EXECUTIVE",
    ]);
    const sql = getSqlClient(c);
    const body = await readJsonObject(c);

    const { customerId, collectionDate, paymentMode, collectionType, collectionAmount } =
      parseCreateCollectionBody(body, auth.role);

    if (auth.role === "SALES_EXECUTIVE") {
      await assertCustomerVisible(sql, { userId: auth.userId!, role: auth.role }, customerId);
    }

    // Collector attribution: a SE recording from mobile is always themselves;
    // a web user (SA/Manager) names the field staff who actually collected.
    const collectedByUserId =
      auth.role === "SALES_EXECUTIVE" ? auth.userId! : optionalString(body, "collectedByUserId");

    const collection = await createCollection(sql, { userId: auth.userId! }, {
      customerId,
      collectionDate,
      paymentMode,
      collectionType,
      collectionAmount,
      collectedByUserId,
      paymentReferenceNumber: optionalString(body, "paymentReferenceNumber"),
      chequeDate: optionalString(body, "chequeDate"),
      bankName: optionalString(body, "bankName"),
      remarks: optionalString(body, "remarks"),
      clientUuid: optionalString(body, "clientUuid"),
      invoiceId: optionalString(body, "invoiceId"),
    });

    if (!collection.existing) {
      await logAudit(sql, actorOf(auth), {
        action: paymentMode === "credit_note" ? "credit_note.create" : "collection.create",
        entityType: "collection",
        entityId: collection.id,
        entityLabel: collection.collectionCode,
        summary: `Recorded ${paymentMode === "credit_note" ? "credit note" : "collection"} ${collection.collectionCode} — ₹${Number(collection.collectionAmount).toLocaleString("en-IN")}`,
        metadata: { amount: collection.collectionAmount, paymentMode },
      });

      // Notifications fire ONLY for field (SALES_EXECUTIVE) creations. When an
      // office role (SUPER_ADMIN / MANAGER / ACCOUNTANT) records a collection it
      // is data entry — don't alert office users (web) or Super Admins (mobile).
      if (auth.role === "SALES_EXECUTIVE") {
        // Context-aware notifications naming the executive ("Sandeep · ₹5,000 from
        // Ravi Motors"): office Web Push + Super-Admin FCM/Alerts feed. Customer +
        // SE first name fetched once, one shared body.
        const vapid = vapidFromEnv(c.env);
        waitUntilSafe(c, 
          (async () => {
            const [name, se] = await Promise.all([
              customerName(sql, customerId),
              executiveFirstName(sql, auth.userId),
            ]);
            const body = collectionBody(se, inr(collectionAmount), name);
            if (vapid) {
              await notifyOfficeWebPush(
                sql,
                vapid,
                { title: "New collection", body, tag: "sri-aparajita-collection", url: "/collections" },
                Math.floor(Date.now() / 1000),
              );
            }
            await notifyAdmins(sql, { type: "admin_collection", title: "New collection", body, customerId });
          })(),
        );
      }
    }

    return c.json(success(c, collection), collection.existing ? 200 : 201);
  })

  .post("/:id/proof", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN", "MANAGER", "SALES_EXECUTIVE"]);
    const bucket = requireBucket(c.env.PHOTOS);

    const form = await c.req.formData().catch(() => null);
    const file = form?.get("photo");
    if (!(file instanceof File) || file.size === 0) {
      throw new ApiError("INVALID_FIELD", "Attach the image as the 'photo' form field.", 422);
    }

    const geo = await photoGeoFromForm(c.env.GOOGLE_GEOCODING_API_KEY, form);
    const sql = getSqlClient(c);
    const proof = await uploadCollectionProof(
      sql,
      bucket,
      { userId: auth.userId!, role: auth.role },
      c.req.param("id"),
      file,
      geo,
    );
    if (!proof.existing) {
      await logAudit(sql, actorOf(auth), {
        action: "collection.proof",
        entityType: "collection",
        entityId: c.req.param("id"),
        summary: "Uploaded a collection receipt",
      });
    }
    return c.json(success(c, proof), proof.existing ? 200 : 201);
  })

  .get("/:id/proof", async (c) => {
    // Receipt image for the collection reviewers only.
    requireRole(c, ["SUPER_ADMIN", "ACCOUNTANT"]);
    const bucket = requireBucket(c.env.PHOTOS);
    const { body, contentType } = await getCollectionProof(
      getSqlClient(c),
      bucket,
      c.req.param("id"),
    );
    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
      },
    });
  })

  .post("/:id/verify", async (c) => {
    const auth = await requireCapability(c, "action:collections.verify", ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"]);
    const sql = getSqlClient(c);
    const collection = await verifyCollection(sql, { userId: auth.userId! }, c.req.param("id"));
    await logAudit(sql, actorOf(auth), {
      action: "collection.verify",
      entityType: "collection",
      entityId: collection.id,
      entityLabel: collection.collectionCode,
      summary: `Verified collection ${collection.collectionCode} — ₹${Number(collection.collectionAmount).toLocaleString("en-IN")}`,
    });
    return c.json(success(c, collection));
  })

  .post("/:id/reject", async (c) => {
    const auth = await requireCapability(c, "action:collections.verify", ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"]);
    const sql = getSqlClient(c);
    const body = await readJsonObject(c);
    const remark = requiredString(body, "remark");
    const collection = await rejectCollection(sql, { userId: auth.userId! }, c.req.param("id"), remark);
    await logAudit(sql, actorOf(auth), {
      action: "collection.reject",
      entityType: "collection",
      entityId: collection.id,
      entityLabel: collection.collectionCode,
      summary: `Rejected collection ${collection.collectionCode}: ${remark}`,
    });
    return c.json(success(c, collection));
  })

  // Edit a receipt / credit note (ledger correction) — SUPER_ADMIN only.
  // Re-reconciles when a verified collection's amount changes.
  .patch("/:id", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN"]);
    const sql = getSqlClient(c);
    const body = await readJsonObject(c);
    const id = c.req.param("id");
    const paymentMode = optionalString(body, "paymentMode") ?? "";
    const amount = optionalNumber(body, "collectionAmount") ?? 0;
    const collection = await updateCollection(sql, { userId: auth.userId! }, id, {
      collectionDate: requiredString(body, "collectionDate"),
      paymentMode,
      collectionAmount: amount,
      paymentReferenceNumber: optionalString(body, "paymentReferenceNumber"),
      remarks: optionalString(body, "remarks"),
    });
    const isCreditNote = paymentMode === "credit_note";
    await logAudit(sql, actorOf(auth), {
      action: isCreditNote ? "credit_note.update" : "collection.update",
      entityType: "collection",
      entityId: collection.id,
      entityLabel: collection.collectionCode,
      summary: `Edited ${isCreditNote ? "credit note" : "collection"} ${collection.collectionCode} — ₹${Number(collection.collectionAmount).toLocaleString("en-IN")}`,
    });
    return c.json(success(c, collection));
  });
