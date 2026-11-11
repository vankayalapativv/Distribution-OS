/**
 * Public photo-upload API — one function per destination (collection proof,
 * delivery-run photo, customer photo). Each builds a FormData and delegates to
 * the timeout-guarded transport in photo-upload-post.
 */
import { File } from "expo-file-system";
import { API_BASE_URL } from "./api";
import type { PickedPhoto } from "./photo-picker";
import { appendGeo, postPhotoUpload, type PhotoGeo } from "./photo-upload-post";

export type { PhotoGeo } from "./photo-upload-post";
export type PhotoCategory = "customer" | "market_intelligence";

/** Upload a collection's proof photo (payment_proofs + R2). Idempotent server-side. */
export async function uploadCollectionProof(
  collectionId: string,
  photoUri: string,
  token: string | null,
  geo?: PhotoGeo,
): Promise<void> {
  const form = new FormData();
  const name = photoUri.split("/").pop() ?? "proof.jpg";
  form.append("photo", new File(photoUri) as unknown as Blob, name);
  appendGeo(form, geo);
  await postPhotoUpload(
    `${API_BASE_URL}/collections/${collectionId}/proof`,
    token ? { Authorization: `Bearer ${token}` } : undefined,
    form,
  );
}

/** Upload a delivery-run photo (odometer or per-stop proof). stopId only for delivery. */
export async function uploadDeliveryPhoto(
  runId: string,
  photoUri: string,
  kind: "start_odometer" | "end_odometer" | "delivery",
  stopId: string | null,
  token: string | null,
  geo?: PhotoGeo,
): Promise<void> {
  const form = new FormData();
  const name = photoUri.split("/").pop() ?? "photo.jpg";
  form.append("photo", new File(photoUri) as unknown as Blob, name);
  form.append("kind", kind);
  if (stopId) form.append("stopId", stopId);
  appendGeo(form, geo);
  await postPhotoUpload(
    `${API_BASE_URL}/deliveries/runs/${runId}/photos`,
    token ? { Authorization: `Bearer ${token}` } : undefined,
    form,
  );
}

export async function uploadCustomerPhoto(
  customerId: string,
  photo: PickedPhoto,
  token: string | null,
  category: PhotoCategory = "market_intelligence",
): Promise<void> {
  const form = new FormData();
  form.append("photo", new File(photo.uri) as unknown as Blob, photo.name);
  form.append("category", category);
  appendGeo(form, photo);
  await postPhotoUpload(
    `${API_BASE_URL}/customers/${customerId}/photos`,
    token ? { Authorization: `Bearer ${token}` } : undefined,
    form,
  );
}
