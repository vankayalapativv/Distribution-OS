import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePhotoStaging } from "./use-photo-staging";
import type { PickedPhoto } from "../photos";

const pickFromCamera = vi.fn<() => Promise<{ photos: PickedPhoto[]; error: string | null }>>();
const pickFromGallery = vi.fn<() => Promise<{ photos: PickedPhoto[]; error: string | null }>>();
const stampPhoto = vi.fn<(...a: unknown[]) => Promise<PickedPhoto>>();
vi.mock("../photos", () => ({ pickFromCamera: () => pickFromCamera(), pickFromGallery: () => pickFromGallery() }));
vi.mock("../photo-stamp", () => ({ stampPhoto: (...a: unknown[]) => stampPhoto(...a) }));

const photo = (uri: string) => ({ uri }) as PickedPhoto;
afterEach(() => vi.clearAllMocks());

function setup(onError = vi.fn()) {
  const view = renderHook(() => usePhotoStaging("Priya", " Balaji ", onError));
  return { ...view, onError };
}

describe("usePhotoStaging.onPickPhotos", () => {
  it("picks from the camera, stamps each photo and stages them", async () => {
    pickFromCamera.mockResolvedValue({ photos: [photo("a"), photo("b")], error: null });
    stampPhoto.mockImplementation(async (p) => ({ ...(p as PickedPhoto), uri: `${(p as PickedPhoto).uri}-stamped` }));
    const { result, onError } = setup();
    await act(async () => { await result.current.onPickPhotos("camera"); });
    expect(onError).toHaveBeenCalledWith(null);
    expect(result.current.photos.map((p) => p.uri)).toEqual(["a-stamped", "b-stamped"]);
    expect(stampPhoto).toHaveBeenCalledWith(expect.anything(), { userName: "Priya", customerName: "Balaji" });
    expect(result.current.preparing).toBe(0);
  });

  it("passes a null customer name to the stamp when it is blank", async () => {
    pickFromCamera.mockResolvedValue({ photos: [photo("a")], error: null });
    stampPhoto.mockResolvedValue(photo("a-stamped"));
    const { result } = setup(); // created with customerName " Balaji " — override below
    const blank = renderHook(() => usePhotoStaging("Priya", "   ", vi.fn()));
    await act(async () => { await blank.result.current.onPickPhotos("camera"); });
    expect(stampPhoto).toHaveBeenCalledWith(expect.anything(), { userName: "Priya", customerName: null });
    void result;
  });

  it("uses the gallery picker for the gallery source", async () => {
    pickFromGallery.mockResolvedValue({ photos: [photo("g")], error: null });
    stampPhoto.mockResolvedValue(photo("g-stamped"));
    const { result } = setup();
    await act(async () => { await result.current.onPickPhotos("gallery"); });
    expect(pickFromGallery).toHaveBeenCalled();
    expect(result.current.photos).toHaveLength(1);
  });

  it("surfaces a pick error and stages nothing", async () => {
    pickFromCamera.mockResolvedValue({ photos: [], error: "Camera permission denied" });
    const { result, onError } = setup();
    await act(async () => { await result.current.onPickPhotos("camera"); });
    expect(onError).toHaveBeenCalledWith("Camera permission denied");
    expect(result.current.photos).toEqual([]);
  });

  it("does nothing when the picker returns no photos", async () => {
    pickFromCamera.mockResolvedValue({ photos: [], error: null });
    const { result } = setup();
    await act(async () => { await result.current.onPickPhotos("camera"); });
    expect(stampPhoto).not.toHaveBeenCalled();
    expect(result.current.preparing).toBe(0);
  });

  it("surfaces a stamping failure and resets the preparing counter", async () => {
    pickFromCamera.mockResolvedValue({ photos: [photo("a")], error: null });
    stampPhoto.mockRejectedValue(new Error("view-shot failed"));
    const { result, onError } = setup();
    await act(async () => { await result.current.onPickPhotos("camera"); });
    expect(onError).toHaveBeenCalledWith("Couldn't prepare the photo. Please try again.");
    expect(result.current.preparing).toBe(0);
    expect(result.current.photos).toEqual([]);
  });

  it("exposes the viewer + uploading setters", () => {
    const { result } = setup();
    act(() => result.current.setViewerUri("x"));
    expect(result.current.viewerUri).toBe("x");
    act(() => result.current.setUploadingUri("y"));
    expect(result.current.uploadingUri).toBe("y");
  });
});
