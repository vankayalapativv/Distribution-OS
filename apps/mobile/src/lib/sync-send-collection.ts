/**
 * Collection sync unit: POST the collection, then upload its mandatory proof
 * photo as part of the SAME unit. Both are idempotent (clientUuid on the create,
 * one-proof-per-collection on the upload), so a network failure retries the pair
 * without creating duplicates.
 */
import { apiFetch } from "./api";
import type { LocalDb } from "./local-db";
import { deleteProofPhoto } from "./photo-files";
import { uploadCollectionProof } from "./photo-upload";
import type { SyncQueueItem } from "./sync-core";

export async function sendCollection(
  item: SyncQueueItem,
  db: LocalDb,
  token: string | null,
): Promise<Record<string, unknown>> {
  const created = (await apiFetch("/collections", {
    method: "POST",
    body: item.payload,
    token,
  })) as Record<string, unknown>;

  const serverId = typeof created.id === "string" ? created.id : null;
  const row = db.first<{
    proof_photo_path: string | null;
    proof_uploaded: number;
    latitude: number | null;
    longitude: number | null;
    geocoded_address: string | null;
  }>(
    "select proof_photo_path, proof_uploaded, latitude, longitude, geocoded_address from collections where client_uuid = ?",
    [item.clientUuid],
  );
  if (serverId && row?.proof_photo_path && row.proof_uploaded !== 1) {
    await uploadCollectionProof(serverId, row.proof_photo_path, token, {
      latitude: row.latitude ?? undefined,
      longitude: row.longitude ?? undefined,
      address: row.geocoded_address ?? undefined,
    });
    db.run("update collections set proof_uploaded = 1 where client_uuid = ?", [item.clientUuid]);
    deleteProofPhoto(row.proof_photo_path);
  }
  return created;
}
