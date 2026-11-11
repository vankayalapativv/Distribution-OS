/**
 * Market-intelligence photo state for the customer screen: fetch (read-through
 * cache), upload (camera/gallery + stamp), and delete. The photo LIST metadata is
 * cached; image bytes rely on expo-image's own disk cache (warmed by prefetch).
 */
import { useState } from "react";
import { apiFetch } from "../api";
import { cacheKeys } from "../cache-keys";
import { useCachedQuery } from "../use-cached-query";
import { pickFromCamera, pickFromGallery, uploadCustomerPhoto } from "../photos";
import { stampPhoto } from "../photo-stamp";
import type { CustomerPhoto } from "./types";

async function fetchPhotos(id: string, token: string | null) {
  const d = await apiFetch<{ photos: CustomerPhoto[] }>(
    `/customers/${id}/photos?category=market_intelligence`,
    { token },
  );
  return d.photos;
}

export function usePhotos(
  id: string | undefined,
  token: string | null,
  customerName: string,
  userName: string,
) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const query = useCachedQuery({
    queryKey: ["photos", id],
    cacheKey: cacheKeys.photos(id ?? ""),
    fetcher: () => fetchPhotos(id!, token),
    enabled: Boolean(id && token),
  });

  async function onDelete(photoId: string) {
    setUploadError(null);
    setUploading(true);
    try {
      await apiFetch(`/photos/${photoId}`, { method: "DELETE", token });
      await query.refetch();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Could not delete the photo — try again.");
    } finally {
      setUploading(false);
    }
  }

  async function onAdd(source: "camera" | "gallery") {
    setUploadError(null);
    const { photos, error } =
      source === "camera" ? await pickFromCamera() : await pickFromGallery();
    if (error) return setUploadError(error);
    if (photos.length === 0) return;
    setUploading(true);
    try {
      for (const photo of photos) {
        const stamped = await stampPhoto(photo, { userName, customerName });
        await uploadCustomerPhoto(id!, stamped, token, "market_intelligence");
      }
      await query.refetch();
    } catch (e) {
      setUploadError(
        e instanceof Error ? e.message : "Upload failed — check your connection and try again.",
      );
    } finally {
      setUploading(false);
    }
  }

  return { query, uploading, uploadError, onDelete, onAdd };
}

export type PhotosState = ReturnType<typeof usePhotos>;
