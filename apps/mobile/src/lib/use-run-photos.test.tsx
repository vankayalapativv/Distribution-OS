import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useRunPhotos } from "./use-run-photos";

const pickFromCamera = vi.fn<() => Promise<{ photos: unknown[]; error: string | null }>>(() => Promise.resolve({ photos: [{ uri: "a" }], error: null }));
const stampPhoto = vi.fn<(...a: unknown[]) => Promise<unknown>>((p) => Promise.resolve({ ...(p as object), stamped: true }));
let authUser: { name: string } | null = { name: "Ravi" };
vi.mock("./auth", () => ({ useAuth: (sel: (s: { user: { name: string } | null }) => unknown) => sel({ user: authUser }) }));
vi.mock("./photo-stamp", () => ({ stampPhoto: (...a: unknown[]) => stampPhoto(...a) }));
vi.mock("./photos", () => ({ pickFromCamera: () => pickFromCamera() }));

beforeEach(() => { pickFromCamera.mockResolvedValue({ photos: [{ uri: "a" }], error: null }); authUser = { name: "Ravi" }; });
afterEach(() => vi.clearAllMocks());

describe("useRunPhotos", () => {
  it("stamps a start photo and stores it", async () => {
    const { result } = renderHook(() => useRunPhotos());
    let ok!: boolean;
    await act(async () => { ok = await result.current.addPhoto("start"); });
    expect(ok).toBe(true);
    expect(stampPhoto).toHaveBeenCalledWith({ uri: "a" }, { userName: "Ravi" });
    expect(result.current.odoPhoto).toMatchObject({ uri: "a", stamped: true });
    expect(result.current.stampingPhoto).toBeNull();
  });

  it("stores an end photo under endPhoto, defaulting the name for a signed-out user", async () => {
    authUser = null;
    const { result } = renderHook(() => useRunPhotos());
    await act(async () => { await result.current.addPhoto("end"); });
    expect(stampPhoto).toHaveBeenCalledWith({ uri: "a" }, { userName: "" });
    expect(result.current.endPhoto).toMatchObject({ uri: "a" });
  });

  it("surfaces a pick error and returns false", async () => {
    pickFromCamera.mockResolvedValue({ photos: [], error: "Camera permission is required." });
    const { result } = renderHook(() => useRunPhotos());
    let ok!: boolean;
    await act(async () => { ok = await result.current.addPhoto("start"); });
    expect(ok).toBe(false);
    expect(result.current.photoError).toBe("Camera permission is required.");
  });

  it("returns false (no error) on an empty pick", async () => {
    pickFromCamera.mockResolvedValue({ photos: [], error: null });
    const { result } = renderHook(() => useRunPhotos());
    let ok!: boolean;
    await act(async () => { ok = await result.current.addPhoto("start"); });
    expect(ok).toBe(false);
    expect(result.current.photoError).toBeNull();
  });

  it("surfaces a stamp failure (Error + non-Error)", async () => {
    stampPhoto.mockRejectedValueOnce(new Error("view-shot failed"));
    const { result } = renderHook(() => useRunPhotos());
    await act(async () => { await result.current.addPhoto("start"); });
    expect(result.current.photoError).toBe("view-shot failed");
    stampPhoto.mockRejectedValueOnce("boom");
    await act(async () => { await result.current.addPhoto("start"); });
    expect(result.current.photoError).toMatch(/Couldn't process the photo/);
  });

  it("resetPhotos clears both shots", async () => {
    const { result } = renderHook(() => useRunPhotos());
    await act(async () => { await result.current.addPhoto("start"); });
    act(() => result.current.resetPhotos());
    expect(result.current.odoPhoto).toBeNull();
    expect(result.current.endPhoto).toBeNull();
  });
});
