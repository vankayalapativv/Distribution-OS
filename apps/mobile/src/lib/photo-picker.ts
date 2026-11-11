/**
 * Camera/gallery pickers shared across New Customer, Market Intelligence, and
 * delivery flows. Camera takes one shot at a time; gallery is multi-select.
 * Both return the same PickedPhoto shape.
 */
import * as ImagePicker from "expo-image-picker";

export interface PickedPhoto {
  uri: string;
  name: string;
  type: string;
  /** Where it was taken (set by stampPhoto): coords always, address when online. */
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
}

function toPickedPhoto(asset: ImagePicker.ImagePickerAsset): PickedPhoto {
  return {
    uri: asset.uri,
    name: asset.fileName ?? `photo-${Date.now()}.jpg`,
    type: asset.mimeType ?? "image/jpeg",
  };
}

/** Open the camera for a single shot. Returns [] if denied or cancelled. */
export async function pickFromCamera(): Promise<{ photos: PickedPhoto[]; error: string | null }> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    return { photos: [], error: "Camera permission is required." };
  }
  const picked = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7 });
  if (picked.canceled || picked.assets.length === 0) {
    return { photos: [], error: null };
  }
  return { photos: picked.assets.map(toPickedPhoto), error: null };
}

/** Open the gallery with multi-select. Returns [] if denied or cancelled. */
export async function pickFromGallery(
  selectionLimit = 10,
): Promise<{ photos: PickedPhoto[]; error: string | null }> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return { photos: [], error: "Photo library permission is required." };
  }
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    quality: 0.7,
    selectionLimit,
  });
  if (picked.canceled || picked.assets.length === 0) {
    return { photos: [], error: null };
  }
  return { photos: picked.assets.map(toPickedPhoto), error: null };
}
