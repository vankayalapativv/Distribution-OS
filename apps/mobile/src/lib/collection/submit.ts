/**
 * Online-only submit for the record-collection screen. Creates the collection,
 * then uploads the proof straight to R2. A STABLE clientUuid (from the screen)
 * makes the create idempotent, so a retry after a failed proof upload reuses the
 * existing collection instead of creating a duplicate.
 */
import { apiFetch } from "../api";
import { istDate } from "../day-flag";
import { uploadCollectionProof, type PickedPhoto } from "../photos";

export interface SubmitParams {
  token: string | null;
  customerId: string;
  collectionType: "general" | "advance";
  amountNum: number;
  mode: string;
  reference: string;
  bankName: string;
  photo: PickedPhoto;
  clientUuid: string;
  onStatus: (status: string) => void;
}

/** Returns the server collection code on success; throws on create OR proof failure. */
export async function submitCollection(p: SubmitParams): Promise<string> {
  p.onStatus("Saving…");
  const res = await apiFetch<{ id: string; collectionCode: string }>("/collections", {
    method: "POST",
    token: p.token,
    body: {
      customerId: p.customerId,
      // IST business day, not UTC — a post-midnight collection must land on today.
      collectionDate: istDate(),
      paymentMode: p.mode,
      collectionType: p.collectionType,
      collectionAmount: p.amountNum,
      paymentReferenceNumber: p.reference.trim() || null,
      bankName: p.mode === "cheque" ? p.bankName.trim() || null : null,
      clientUuid: p.clientUuid,
    },
  });

  p.onStatus("Uploading receipt…");
  try {
    await uploadCollectionProof(res.id, p.photo.uri, p.token, {
      latitude: p.photo.latitude ?? undefined,
      longitude: p.photo.longitude ?? undefined,
      address: p.photo.address ?? undefined,
    });
  } catch {
    throw new Error("Receipt saved failed to upload — tap Record to try again.");
  }
  return res.collectionCode;
}
