import { useState } from "react";
import { pickFromCamera, pickFromGallery, type PickedPhoto } from "../photos";
import { stampPhoto } from "../photo-stamp";

/**
 * Local (pre-upload) photo staging for the New Customer form: pick → stamp →
 * hold in memory. The actual upload happens on Save. `onError` surfaces pick /
 * stamp failures through the form's shared error banner.
 */
export function usePhotoStaging(
  userName: string,
  customerName: string,
  onError: (message: string | null) => void,
) {
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  // Count of photos currently being prepared (picked → stamped) — drives the
  // skeleton tiles so the tap→thumbnail gap isn't silent.
  const [preparing, setPreparing] = useState(0);
  // The photo URI whose server upload is in flight (spinner overlay on Save).
  const [uploadingUri, setUploadingUri] = useState<string | null>(null);
  // The photo URI shown full-screen in the pinch-zoom viewer (null = closed).
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  async function onPickPhotos(source: "camera" | "gallery") {
    onError(null);
    const { photos: picked, error: pickError } =
      source === "camera" ? await pickFromCamera() : await pickFromGallery();
    if (pickError) {
      onError(pickError);
      return;
    }
    if (picked.length === 0) return;
    // Show a skeleton tile per picked photo while it's stamped (view-shot capture
    // takes a moment), then swap in the real thumbnails.
    setPreparing((c) => c + picked.length);
    try {
      // Burn address/date/time/name into each photo before it enters the list.
      const stamped = await Promise.all(
        picked.map((p) => stampPhoto(p, { userName, customerName: customerName.trim() || null })),
      );
      setPhotos((prev) => [...prev, ...stamped]);
    } catch {
      onError("Couldn't prepare the photo. Please try again.");
    } finally {
      setPreparing((c) => Math.max(0, c - picked.length));
    }
  }

  return { photos, setPhotos, preparing, uploadingUri, setUploadingUri, viewerUri, setViewerUri, onPickPhotos };
}

export type PhotoStaging = ReturnType<typeof usePhotoStaging>;
