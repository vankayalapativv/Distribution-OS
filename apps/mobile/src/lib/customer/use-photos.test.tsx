import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePhotos } from "./use-photos";
import { cacheKeys } from "../cache-keys";

const apiFetch = vi.fn();
const refetch = vi.fn<() => Promise<void>>(() => Promise.resolve());
const pickFromCamera = vi.fn();
const pickFromGallery = vi.fn();
const uploadCustomerPhoto = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const stampPhoto = vi.fn<(...a: unknown[]) => Promise<unknown>>((p) => Promise.resolve(p));
const useCachedQuery = vi.fn((cfg: unknown) => ({ cfg, data: [], refetch }));
vi.mock("../api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("../use-cached-query", () => ({ useCachedQuery: (c: unknown) => useCachedQuery(c) }));
vi.mock("../photos", () => ({
  pickFromCamera: () => pickFromCamera(), pickFromGallery: () => pickFromGallery(),
  uploadCustomerPhoto: (...a: unknown[]) => uploadCustomerPhoto(...a),
}));
vi.mock("../photo-stamp", () => ({ stampPhoto: (...a: unknown[]) => stampPhoto(...a) }));

const setup = () => renderHook(() => usePhotos("c1", "tok", "Balaji", "Priya"));
beforeEach(() => { apiFetch.mockResolvedValue({ photos: [] }); });
afterEach(() => vi.clearAllMocks());

describe("usePhotos query", () => {
  it("reads the market-intelligence photos for the customer", async () => {
    setup();
    const cfg = useCachedQuery.mock.calls.at(-1)![0] as { queryKey: unknown[]; cacheKey: string; fetcher: () => Promise<unknown>; enabled: boolean };
    expect(cfg).toMatchObject({ queryKey: ["photos", "c1"], cacheKey: cacheKeys.photos("c1"), enabled: true });
    await cfg.fetcher();
    expect(apiFetch).toHaveBeenCalledWith("/customers/c1/photos?category=market_intelligence", { token: "tok" });
  });
  it("disables the query without an id/token", () => {
    renderHook(() => usePhotos(undefined, null, "Balaji", "Priya"));
    expect((useCachedQuery.mock.calls.at(-1)![0] as { enabled: boolean }).enabled).toBe(false);
  });
});

describe("usePhotos.onDelete", () => {
  it("deletes then refetches", async () => {
    const { result } = setup();
    await act(async () => { await result.current.onDelete("p1"); });
    expect(apiFetch).toHaveBeenCalledWith("/photos/p1", { method: "DELETE", token: "tok" });
    expect(refetch).toHaveBeenCalled();
    expect(result.current.uploading).toBe(false);
  });
  it("surfaces a delete failure (Error + non-Error)", async () => {
    apiFetch.mockRejectedValueOnce(new Error("locked"));
    const { result } = setup();
    await act(async () => { await result.current.onDelete("p1"); });
    expect(result.current.uploadError).toBe("locked");
    apiFetch.mockRejectedValueOnce("boom");
    await act(async () => { await result.current.onDelete("p1"); });
    expect(result.current.uploadError).toMatch(/Could not delete the photo/);
  });
});

describe("usePhotos.onAdd", () => {
  it("stamps + uploads each picked photo then refetches", async () => {
    pickFromCamera.mockResolvedValue({ photos: [{ uri: "a" }, { uri: "b" }], error: null });
    const { result } = setup();
    await act(async () => { await result.current.onAdd("camera"); });
    expect(stampPhoto).toHaveBeenCalledTimes(2);
    expect(uploadCustomerPhoto).toHaveBeenCalledWith("c1", { uri: "a" }, "tok", "market_intelligence");
    expect(refetch).toHaveBeenCalled();
  });
  it("uses the gallery picker and surfaces a pick error / empty", async () => {
    pickFromGallery.mockResolvedValue({ photos: [], error: "denied" });
    const { result } = setup();
    await act(async () => { await result.current.onAdd("gallery"); });
    expect(result.current.uploadError).toBe("denied");
    pickFromGallery.mockResolvedValue({ photos: [], error: null });
    await act(async () => { await result.current.onAdd("gallery"); });
    expect(uploadCustomerPhoto).not.toHaveBeenCalled();
  });
  it("surfaces an upload failure (Error + non-Error)", async () => {
    pickFromCamera.mockResolvedValue({ photos: [{ uri: "a" }], error: null });
    uploadCustomerPhoto.mockRejectedValueOnce(new Error("offline"));
    const { result } = setup();
    await act(async () => { await result.current.onAdd("camera"); });
    expect(result.current.uploadError).toBe("offline");
    expect(result.current.uploading).toBe(false);
    uploadCustomerPhoto.mockRejectedValueOnce("boom");
    await act(async () => { await result.current.onAdd("camera"); });
    expect(result.current.uploadError).toMatch(/Upload failed/);
  });
});
