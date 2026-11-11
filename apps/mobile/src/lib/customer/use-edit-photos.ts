import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch } from "../api";
import { pickFromCamera, pickFromGallery, uploadCustomerPhoto } from "../photos";
import { stampPhoto } from "../photo-stamp";

/**
 * Customer photos (shop/storefront) for the edit screen — fetched, uploaded and
 * deleted online. Separate from market-intelligence photos. `onError` surfaces
 * failures through the form's shared error banner.
 */
export function useEditPhotos(
  id: string,
  token: string | null,
  userName: string,
  customerName: string | null,
  onError: (message: string | null) => void,
) {
  const [photoBusy, setPhotoBusy] = useState(false);
  const query = useQuery({
    queryKey: ["customer-photos", id],
    queryFn: () =>
      apiFetch<{ photos: { id: string }[] }>(
        `/customers/${id}/photos?category=customer`,
        { token },
      ).then((d) => d.photos),
    enabled: Boolean(token && id),
  });

  async function onAddPhotos(source: "camera" | "gallery") {
    onError(null);
    const { photos, error: pickError } =
      source === "camera" ? await pickFromCamera() : await pickFromGallery();
    if (pickError) {
      onError(pickError);
      return;
    }
    if (photos.length === 0) return;
    setPhotoBusy(true);
    try {
      for (const photo of photos) {
        const stamped = await stampPhoto(photo, { userName, customerName });
        await uploadCustomerPhoto(id, stamped, token, "customer");
      }
      await query.refetch();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Photo upload failed — try again.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function onDeletePhoto(photoId: string) {
    onError(null);
    setPhotoBusy(true);
    try {
      await apiFetch(`/photos/${photoId}`, { method: "DELETE", token });
      await query.refetch();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not delete the photo — try again.");
    } finally {
      setPhotoBusy(false);
    }
  }

  return { query, photoBusy, onAddPhotos, onDeletePhoto };
}

export type EditPhotos = ReturnType<typeof useEditPhotos>;
