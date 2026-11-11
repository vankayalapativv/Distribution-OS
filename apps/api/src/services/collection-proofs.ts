import type { R2Bucket } from "@cloudflare/workers-types";
import { R2_STORAGE_CLASS } from "../lib/r2";
import type { SqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";
import type { PhotoGeo } from "../lib/geocode";
import type { Role } from "../types";

type Row = Record<string, unknown>;

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
}

interface ProofContext {
  userId: string;
  role?: Role | null;
}

const MAX_PROOF_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

/**
 * Attaches a payment-proof photo to a collection. Idempotent: a collection
 * carries exactly one proof, so if one already exists this returns it without
 * touching R2 — the mobile sync retries the create+proof pair as one unit, and
 * an idempotent replay must not create a duplicate proof or orphan an R2 object.
 * A SALES_EXECUTIVE may only attach to a collection they recorded.
 */
export async function uploadCollectionProof(
  sql: SqlClient,
  bucket: R2Bucket,
  context: ProofContext,
  collectionId: string,
  file: File,
  geo: PhotoGeo = { latitude: null, longitude: null, geocodedAddress: null },
) {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new ApiError("INVALID_FIELD", "Proof must be a JPEG, PNG, WebP image or a PDF.", 422);
  }
  if (file.size === 0) {
    throw new ApiError("INVALID_FIELD", "Attach the image as the 'photo' form field.", 422);
  }
  if (file.size > MAX_PROOF_BYTES) {
    throw new ApiError("INVALID_FIELD", "Proof must be under 10 MB.", 422);
  }

  const [collection] = await sql`
    /* get_collection_for_proof */
    select id, collected_by_user_id as "collectedByUserId"
    from collections
    where id = ${collectionId}::uuid
  ` as Row[];
  if (!collection) throw new ApiError("NOT_FOUND", "Collection not found.", 404);
  if (
    context.role === "SALES_EXECUTIVE" &&
    str(collection.collectedByUserId) !== context.userId
  ) {
    throw new ApiError("NOT_FOUND", "Collection not found.", 404);
  }

  // Idempotent replay guard: one proof per collection.
  const [existing] = await sql`
    /* get_existing_payment_proof */
    select id, file_url as "fileKey", content_type as "contentType", created_at as "createdAt"
    from payment_proofs
    where collection_id = ${collectionId}::uuid
    limit 1
  ` as Row[];
  if (existing) {
    return {
      id: str(existing.id),
      collectionId,
      contentType: str(existing.contentType),
      createdAt: str(existing.createdAt),
      existing: true,
    };
  }

  const extByMime: Record<string, string> = { "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
  const extension = extByMime[file.type] ?? "jpg";
  const fileKey = `collections/${collectionId}/${crypto.randomUUID()}.${extension}`;

  await bucket.put(fileKey, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
    storageClass: R2_STORAGE_CLASS,
  });

  const [row] = await sql`
    /* create_payment_proof */
    insert into payment_proofs (
      collection_id, file_url, proof_type, content_type, size_bytes, uploaded_by,
      latitude, longitude, geocoded_address
    ) values (
      ${collectionId}::uuid,
      ${fileKey},
      'payment',
      ${file.type},
      ${file.size},
      ${context.userId}::uuid,
      ${geo.latitude},
      ${geo.longitude},
      ${geo.geocodedAddress}
    )
    returning id, collection_id as "collectionId", content_type as "contentType", created_at as "createdAt"
  ` as Row[];

  return {
    id: str(row.id),
    collectionId: str(row.collectionId),
    contentType: str(row.contentType),
    createdAt: str(row.createdAt),
    existing: false,
  };
}

/**
 * Streams a collection's payment-proof (receipt) image. Office reviewers only —
 * SUPER_ADMIN and ACCOUNTANT, the roles that verify collections. The caller
 * gates the route; this re-checks nothing role-wise but 404s a missing proof.
 */
export async function getCollectionProof(
  sql: SqlClient,
  bucket: R2Bucket,
  collectionId: string,
) {
  const [row] = await sql`
    /* get_collection_proof_file */
    select file_url as "fileKey", content_type as "contentType"
    from payment_proofs
    where collection_id = ${collectionId}::uuid
    order by created_at
    limit 1
  ` as Row[];
  if (!row || !str(row.fileKey)) {
    throw new ApiError("NOT_FOUND", "Receipt not found.", 404);
  }

  const object = await bucket.get(str(row.fileKey));
  if (!object) throw new ApiError("NOT_FOUND", "Receipt not found.", 404);

  return {
    body: object.body as unknown as ReadableStream,
    contentType: str(row.contentType) || "image/jpeg",
  };
}
