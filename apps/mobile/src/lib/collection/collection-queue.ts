/**
 * Offline collection write: persist the mandatory proof photo to durable
 * storage, record the collection to the local outbox, and enqueue the write.
 * The sync-send `collection` handler POSTs the collection then uploads the
 * proof (both idempotent) once back online.
 */
import { type LocalDb, withTransaction } from "../local-db";
import { persistProofPhoto } from "../photo-files";
import type { PickedPhoto } from "../photos";
import { enqueue } from "../sync-core";

export interface CollectionQueueInput {
  clientUuid: string;
  customerId: string;
  collectionDate: string;
  paymentMode: string;
  /** 'general' (settle dues) or 'advance' (paying ahead). */
  collectionType: string;
  collectionAmount: number;
  paymentReferenceNumber: string | null;
  bankName: string | null;
  /** The stamped proof photo (camera/gallery) — persisted here for the upload. */
  photo: PickedPhoto;
}

export function recordCollection(db: LocalDb, input: CollectionQueueInput, now: number): void {
  // Copy the proof out of the volatile picker cache into the document dir FIRST
  // (file I/O, kept out of the DB transaction) so it survives until sync.
  const proofPath = persistProofPhoto(input.clientUuid, input.photo);

  withTransaction(db, () => {
    db.run(
      `insert into collections
         (client_uuid, customer_id, collection_date, payment_mode, collection_type,
          collection_amount, payment_reference_number, bank_name, proof_photo_path,
          proof_uploaded, latitude, longitude, geocoded_address, created_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [
        input.clientUuid,
        input.customerId,
        input.collectionDate,
        input.paymentMode,
        input.collectionType,
        input.collectionAmount,
        input.paymentReferenceNumber,
        input.bankName,
        proofPath,
        input.photo.latitude ?? null,
        input.photo.longitude ?? null,
        input.photo.address ?? null,
        now,
      ],
    );
    enqueue(
      db,
      "collection",
      input.clientUuid,
      {
        customerId: input.customerId,
        collectionDate: input.collectionDate,
        paymentMode: input.paymentMode,
        collectionType: input.collectionType,
        collectionAmount: input.collectionAmount,
        paymentReferenceNumber: input.paymentReferenceNumber,
        bankName: input.bankName,
        clientUuid: input.clientUuid,
      },
      now,
    );
  });
}
