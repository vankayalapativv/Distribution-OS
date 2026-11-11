import type { R2Bucket } from "@cloudflare/workers-types";
import { R2_STORAGE_CLASS } from "../lib/r2";
import type { SqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";
import { assertCustomerVisible } from "./customers";
import type { PhotoGeo } from "../lib/geocode";
import type { Role } from "../types";

type Row = Record<string, unknown>;

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
}

interface PhotoContext {
  userId: string;
  role?: Role | null;
}

const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB per photo
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
/** 'customer' = shop/owner images on the record; 'market_intelligence' = shelf captures. */
export const PHOTO_CATEGORIES = new Set(["customer", "market_intelligence"]);

export async function uploadCustomerPhoto(
  sql: SqlClient,
  bucket: R2Bucket,
  context: PhotoContext,
  customerId: string,
  file: File,
  category: string = "market_intelligence",
  geo: PhotoGeo = { latitude: null, longitude: null, geocodedAddress: null },
) {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new ApiError("INVALID_FIELD", "Photo must be a JPEG, PNG or WebP image.", 422);
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new ApiError("INVALID_FIELD", "Photo must be under 10 MB.", 422);
  }
  if (!PHOTO_CATEGORIES.has(category)) {
    throw new ApiError("INVALID_FIELD", "category must be 'customer' or 'market_intelligence'.", 422);
  }

  await assertCustomerVisible(sql, context, customerId);

  const extByMime: Record<string, string> = { "image/png": "png", "image/webp": "webp" };
  const extension = extByMime[file.type] ?? "jpg";
  const fileKey = `customers/${customerId}/${crypto.randomUUID()}.${extension}`;

  await bucket.put(fileKey, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
    storageClass: R2_STORAGE_CLASS,
  });

  const [row] = await sql`
    /* create_customer_photo */
    insert into customer_photos (
      customer_id, uploaded_by, file_key, content_type, size_bytes, category,
      latitude, longitude, geocoded_address
    ) values (
      ${customerId}::uuid,
      ${context.userId}::uuid,
      ${fileKey},
      ${file.type},
      ${file.size},
      ${category},
      ${geo.latitude},
      ${geo.longitude},
      ${geo.geocodedAddress}
    )
    returning
      id,
      customer_id as "customerId",
      file_key as "fileKey",
      content_type as "contentType",
      category,
      created_at as "createdAt"
  ` as Row[];

  return {
    id: str(row.id),
    customerId: str(row.customerId),
    contentType: str(row.contentType),
    category: str(row.category),
    createdAt: str(row.createdAt),
  };
}

export async function listCustomerPhotos(
  sql: SqlClient,
  context: PhotoContext,
  customerId: string,
  category: string | null = null,
) {
  if (category !== null && !PHOTO_CATEGORIES.has(category)) {
    throw new ApiError("INVALID_FIELD", "category must be 'customer' or 'market_intelligence'.", 422);
  }
  await assertCustomerVisible(sql, context, customerId);
  const rows = await sql`
    /* list_customer_photos */
    select p.id, p.content_type as "contentType", p.category, p.created_at as "createdAt",
           u.name as "uploaderName"
    from customer_photos p
    left join users u on u.id = p.uploaded_by
    where p.customer_id = ${customerId}::uuid
      and (${category}::text is null or p.category = ${category})
    order by p.created_at desc
  ` as Row[];

  return rows.map((r) => ({
    id: str(r.id),
    contentType: str(r.contentType),
    category: str(r.category),
    createdAt: str(r.createdAt),
    uploaderName: r.uploaderName == null ? null : str(r.uploaderName),
  }));
}

export async function getPhotoStream(
  sql: SqlClient,
  bucket: R2Bucket,
  context: { userId: string; role: string | null },
  photoId: string,
): Promise<{ body: ReadableStream; contentType: string }> {
  // IDOR fix (2026-10-05): scope the byte stream like deletePhoto — a
  // SALES_EXECUTIVE may only read photos of customers they created; foreign
  // photos 404 so their existence isn't revealed. Office roles see all.
  const [photo] = await sql`
    /* get_photo_by_id */
    select p.id, p.file_key as "fileKey", p.content_type as "contentType",
      c.created_by as "customerCreatedBy"
    from customer_photos p
    join customers c on c.id = p.customer_id
    where p.id = ${photoId}::uuid
  ` as Row[];
  if (!photo) throw new ApiError("NOT_FOUND", "Photo not found.", 404);
  if (
    context.role === "SALES_EXECUTIVE" &&
    str(photo.customerCreatedBy) !== context.userId
  ) {
    throw new ApiError("NOT_FOUND", "Photo not found.", 404);
  }

  const object = await bucket.get(str(photo.fileKey));
  if (!object) throw new ApiError("NOT_FOUND", "Photo file is missing from storage.", 404);

  return {
    // workers-types ReadableStream is structurally the DOM one at runtime
    body: object.body as unknown as ReadableStream,
    contentType: str(photo.contentType) || "image/jpeg",
  };
}

/**
 * Photo deletion: SUPER_ADMIN/MANAGER anywhere; a SALES_EXECUTIVE only on
 * customers they created (decided 2026-07-11, superseding the admin-only
 * rule) — foreign photos 404 so their existence isn't revealed.
 */
export async function deletePhoto(
  sql: SqlClient,
  bucket: R2Bucket,
  context: { userId: string; role: string | null },
  photoId: string,
): Promise<void> {
  const [photo] = await sql`
    /* get_photo_for_delete */
    select p.id, p.file_key as "fileKey", c.created_by as "customerCreatedBy"
    from customer_photos p
    join customers c on c.id = p.customer_id
    where p.id = ${photoId}::uuid
  ` as Row[];
  if (!photo) throw new ApiError("NOT_FOUND", "Photo not found.", 404);
  if (
    context.role === "SALES_EXECUTIVE" &&
    str(photo.customerCreatedBy) !== context.userId
  ) {
    throw new ApiError("NOT_FOUND", "Photo not found.", 404);
  }

  await bucket.delete(str(photo.fileKey));
  await sql`
    /* delete_customer_photo */
    delete from customer_photos where id = ${photoId}::uuid
  `;
}
