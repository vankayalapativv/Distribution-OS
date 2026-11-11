import type { R2Bucket } from "@cloudflare/workers-types";
import { Hono } from "hono";
import { success } from "../lib/api-response";
import { requireRole } from "../lib/authz";
import { getSqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";
import {
  deletePhoto,
  getPhotoStream,
  listCustomerPhotos,
  uploadCustomerPhoto,
} from "../services/photos";
import { photoGeoFromForm } from "../lib/geocode";
import { actorOf, logAudit } from "../services/audit";
import type { ApiEnv } from "../types";

const PHOTO_ROLES = ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT", "SALES_EXECUTIVE"] as const;

function requireBucket(bucket: R2Bucket | undefined): R2Bucket {
  if (!bucket) {
    throw new ApiError("CONFIG", "Photo storage is not configured.", 500);
  }
  return bucket;
}

/** Per-customer market-intelligence photos: /customers/:id/photos */
export const customerPhotosRoutes = new Hono<ApiEnv>()
  .post("/:id/photos", async (c) => {
    const auth = requireRole(c, [...PHOTO_ROLES]);
    const bucket = requireBucket(c.env.PHOTOS);

    const form = await c.req.formData().catch(() => null);
    const file = form?.get("photo");
    if (!(file instanceof File) || file.size === 0) {
      throw new ApiError("INVALID_FIELD", "Attach the image as the 'photo' form field.", 422);
    }

    const categoryField = form?.get("category");
    const geo = await photoGeoFromForm(c.env.GOOGLE_GEOCODING_API_KEY, form);
    const category =
      typeof categoryField === "string" && categoryField.length > 0
        ? categoryField
        : "market_intelligence";
    const sql = getSqlClient(c);
    const photo = await uploadCustomerPhoto(
      sql,
      bucket,
      { userId: auth.userId!, role: auth.role },
      c.req.param("id"),
      file,
      category,
      geo,
    );
    await logAudit(sql, actorOf(auth), {
      action: "photo.upload",
      entityType: "customer",
      entityId: c.req.param("id"),
      summary: `Uploaded a customer photo (${category})`,
      metadata: { category },
    });
    return c.json(success(c, photo), 201);
  })
  .get("/:id/photos", async (c) => {
    const auth = requireRole(c, [...PHOTO_ROLES]);
    const photos = await listCustomerPhotos(
      getSqlClient(c),
      { userId: auth.userId!, role: auth.role },
      c.req.param("id"),
      c.req.query("category") ?? null,
    );
    return c.json(success(c, { photos }));
  });

/** Binary streaming + admin deletion: /photos/:photoId */
export const photoFileRoutes = new Hono<ApiEnv>()
  .get("/:photoId", async (c) => {
    const auth = requireRole(c, [...PHOTO_ROLES]);
    const bucket = requireBucket(c.env.PHOTOS);

    const { body, contentType } = await getPhotoStream(
      getSqlClient(c),
      bucket,
      { userId: auth.userId!, role: auth.role },
      c.req.param("photoId"),
    );

    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=86400",
      },
    });
  })
  .delete("/:photoId", async (c) => {
    // Admins anywhere; SEs only on customers they created (service-enforced).
    const auth = requireRole(c, ["SUPER_ADMIN", "MANAGER", "SALES_EXECUTIVE"]);
    const bucket = requireBucket(c.env.PHOTOS);
    const sql = getSqlClient(c);
    await deletePhoto(
      sql,
      bucket,
      { userId: auth.userId!, role: auth.role },
      c.req.param("photoId"),
    );
    await logAudit(sql, actorOf(auth), {
      action: "photo.delete",
      entityType: "photo",
      entityId: c.req.param("photoId"),
      summary: "Deleted a photo",
    });
    return c.json(success(c, { deleted: true }));
  });
