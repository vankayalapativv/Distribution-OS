import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useEditPhotos } from "./use-edit-photos";

const apiFetch = vi.fn();
const refetch = vi.fn<() => Promise<void>>(() => Promise.resolve());
const pickFromCamera = vi.fn();
const pickFromGallery = vi.fn();
const uploadCustomerPhoto = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const stampPhoto = vi.fn<(...a: unknown[]) => Promise<unknown>>((p) => Promise.resolve(p));
const useQuery = vi.fn((cfg: unknown) => ({ cfg, data: [], refetch }));
vi.mock("@tanstack/react-query", () => ({ useQuery: (c: unknown) => useQuery(c) }));
vi.mock("../api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("../photos", () => ({
  pickFromCamera: () => pickFromCamera(), pickFromGallery: () => pickFromGallery(),
  uploadCustomerPhoto: (...a: unknown[]) => uploadCustomerPhoto(...a),
}));
vi.mock("../photo-stamp", () => ({ stampPhoto: (...a: unknown[]) => stampPhoto(...a) }));

function setup(onError = vi.fn()) {
  const view = renderHook(() => useEditPhotos("c1", "tok", "Priya", "Balaji", onError));
  return { ...view, onError };
}
beforeEach(() => { apiFetch.mockResolvedValue({ photos: [] }); });
afterEach(() => vi.clearAllMocks());

describe("useEditPhotos query", () => {
  it("reads the customer-category photos", async () => {
    setup();
    const cfg = useQuery.mock.calls.at(-1)![0] as { queryKey: unknown[]; queryFn: () => Promise<unknown>; enabled: boolean };
    expect(cfg).toMatchObject({ queryKey: ["customer-photos", "c1"], enabled: true });
    await cfg.queryFn();
    expect(apiFetch).toHaveBeenCalledWith("/customers/c1/photos?category=customer", { token: "tok" });
  });
});

describe("useEditPhotos.onAddPhotos", () => {
  it("stamps + uploads each photo then refetches", async () => {
    pickFromCamera.mockResolvedValue({ photos: [{ uri: "a" }], error: null });
    const { result } = setup();
    await act(async () => { await result.current.onAddPhotos("camera"); });
    expect(uploadCustomerPhoto).toHaveBeenCalledWith("c1", { uri: "a" }, "tok", "customer");
    expect(refetch).toHaveBeenCalled();
    expect(result.current.photoBusy).toBe(false);
  });
  it("surfaces a pick error, ignores an empty pick", async () => {
    pickFromGallery.mockResolvedValue({ photos: [], error: "denied" });
    const { result, onError } = setup();
    await act(async () => { await result.current.onAddPhotos("gallery"); });
    expect(onError).toHaveBeenCalledWith("denied");
    pickFromGallery.mockResolvedValue({ photos: [], error: null });
    await act(async () => { await result.current.onAddPhotos("gallery"); });
    expect(uploadCustomerPhoto).not.toHaveBeenCalled();
  });
  it("surfaces an upload failure (Error + non-Error)", async () => {
    pickFromCamera.mockResolvedValue({ photos: [{ uri: "a" }], error: null });
    uploadCustomerPhoto.mockRejectedValueOnce(new Error("offline"));
    const { result, onError } = setup();
    await act(async () => { await result.current.onAddPhotos("camera"); });
    expect(onError).toHaveBeenCalledWith("offline");
    uploadCustomerPhoto.mockRejectedValueOnce("boom");
    await act(async () => { await result.current.onAddPhotos("camera"); });
    expect(onError).toHaveBeenCalledWith(expect.stringMatching(/Photo upload failed/));
  });
});

describe("useEditPhotos.onDeletePhoto", () => {
  it("deletes then refetches", async () => {
    const { result } = setup();
    await act(async () => { await result.current.onDeletePhoto("p1"); });
    expect(apiFetch).toHaveBeenCalledWith("/photos/p1", { method: "DELETE", token: "tok" });
    expect(refetch).toHaveBeenCalled();
  });
  it("surfaces a delete failure (Error + non-Error)", async () => {
    apiFetch.mockRejectedValueOnce(new Error("locked"));
    const { result, onError } = setup();
    await act(async () => { await result.current.onDeletePhoto("p1"); });
    expect(onError).toHaveBeenCalledWith("locked");
    apiFetch.mockRejectedValueOnce("boom");
    await act(async () => { await result.current.onDeletePhoto("p1"); });
    expect(onError).toHaveBeenCalledWith(expect.stringMatching(/Could not delete the photo/));
  });
});
