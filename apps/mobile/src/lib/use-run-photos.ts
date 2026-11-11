// Meter-photo capture for the delivery run forms: pick from camera, stamp with
// the address + date/time overlay, and track which shot is being stamped so the
// button can show a spinner.

import { useState } from "react";
import { useAuth } from "./auth";
import { stampPhoto } from "./photo-stamp";
import { pickFromCamera, type PickedPhoto } from "./photos";

export function useRunPhotos() {
  const user = useAuth((s) => s.user);
  const [odoPhoto, setOdoPhoto] = useState<PickedPhoto | null>(null);
  const [endPhoto, setEndPhoto] = useState<PickedPhoto | null>(null);
  const [stampingPhoto, setStampingPhoto] = useState<"start" | "end" | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  async function addPhoto(which: "start" | "end"): Promise<boolean> {
    const { photos, error } = await pickFromCamera();
    if (error) {
      setPhotoError(error);
      return false;
    }
    if (!photos.length) return false;
    setStampingPhoto(which);
    try {
      const stamped = await stampPhoto(photos[0], { userName: user?.name ?? "" });
      if (which === "start") setOdoPhoto(stamped);
      else setEndPhoto(stamped);
      setPhotoError(null);
      return true;
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Couldn't process the photo. Try again.");
      return false;
    } finally {
      setStampingPhoto(null);
    }
  }

  const resetPhotos = () => {
    setOdoPhoto(null);
    setEndPhoto(null);
  };

  return { odoPhoto, setOdoPhoto, endPhoto, setEndPhoto, stampingPhoto, photoError, addPhoto, resetPhotos };
}
