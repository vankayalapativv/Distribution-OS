import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pickFromCamera, pickFromGallery } from "./photo-picker";

const requestCameraPermissionsAsync = vi.fn<() => Promise<{ granted: boolean }>>(() => Promise.resolve({ granted: true }));
const requestMediaLibraryPermissionsAsync = vi.fn<() => Promise<{ granted: boolean }>>(() => Promise.resolve({ granted: true }));
const launchCameraAsync = vi.fn();
const launchImageLibraryAsync = vi.fn();
vi.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: () => requestCameraPermissionsAsync(),
  requestMediaLibraryPermissionsAsync: () => requestMediaLibraryPermissionsAsync(),
  launchCameraAsync: (...a: unknown[]) => launchCameraAsync(...a),
  launchImageLibraryAsync: (...a: unknown[]) => launchImageLibraryAsync(...a),
}));
beforeEach(() => {
  requestCameraPermissionsAsync.mockResolvedValue({ granted: true });
  requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
});
afterEach(() => vi.clearAllMocks());

describe("pickFromCamera", () => {
  it("errors when camera permission is denied", async () => {
    requestCameraPermissionsAsync.mockResolvedValue({ granted: false });
    expect(await pickFromCamera()).toEqual({ photos: [], error: "Camera permission is required." });
  });
  it("returns nothing (no error) when cancelled", async () => {
    launchCameraAsync.mockResolvedValue({ canceled: true, assets: [] });
    expect(await pickFromCamera()).toEqual({ photos: [], error: null });
  });
  it("maps a captured asset, filling name/type fallbacks", async () => {
    launchCameraAsync.mockResolvedValue({ canceled: false, assets: [{ uri: "file://a.jpg" }] });
    const { photos } = await pickFromCamera();
    expect(photos[0]).toMatchObject({ uri: "file://a.jpg", type: "image/jpeg" });
    expect(photos[0].name).toMatch(/^photo-\d+\.jpg$/);
  });
});

describe("pickFromGallery", () => {
  it("errors when library permission is denied", async () => {
    requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false });
    expect(await pickFromGallery()).toEqual({ photos: [], error: "Photo library permission is required." });
  });
  it("returns nothing (no error) on an empty selection", async () => {
    launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [] });
    expect(await pickFromGallery(5)).toEqual({ photos: [], error: null });
    expect(launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({ selectionLimit: 5 }));
  });
  it("maps multi-selected assets using their own names/types", async () => {
    launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file://a.png", fileName: "a.png", mimeType: "image/png" }],
    });
    const { photos } = await pickFromGallery();
    expect(photos[0]).toEqual({ uri: "file://a.png", name: "a.png", type: "image/png" });
  });
});
