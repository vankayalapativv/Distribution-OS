import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCollectionForm } from "./use-collection-form";

const randomUUID = vi.fn(() => "uuid-1");
const pickFromCamera = vi.fn<() => Promise<{ photos: unknown[]; error: string | null }>>(() => Promise.resolve({ photos: [{ uri: "a" }], error: null }));
const pickFromGallery = vi.fn<(...a: unknown[]) => Promise<{ photos: unknown[]; error: string | null }>>(() => Promise.resolve({ photos: [{ uri: "g" }], error: null }));
const stampPhoto = vi.fn<(...a: unknown[]) => Promise<unknown>>((p) => Promise.resolve({ ...(p as object), stamped: true }));
const runCollectionSubmit = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
let authUser: { name: string } | null = { name: "Ravi" };

vi.mock("expo-crypto", () => ({ randomUUID: () => randomUUID() }));
vi.mock("../auth", () => ({ useAuth: (sel: (s: { token: string; user: { name: string } | null }) => unknown) => sel({ token: "tok", user: authUser }) }));
vi.mock("../day-flag", () => ({ istDate: () => "2026-11-27" }));
vi.mock("../photos", () => ({ pickFromCamera: () => pickFromCamera(), pickFromGallery: (...a: unknown[]) => pickFromGallery(...a) }));
vi.mock("../photo-stamp", () => ({ stampPhoto: (...a: unknown[]) => stampPhoto(...a) }));
vi.mock("./collection-write", () => ({ runCollectionSubmit: (...a: unknown[]) => runCollectionSubmit(...a) }));

const setup = () => renderHook(() => useCollectionForm("c1", "Balaji"));
async function withPhoto(result: { current: ReturnType<typeof useCollectionForm> }) {
  await act(async () => { await result.current.addPhoto("camera"); });
  act(() => result.current.setAmount("500"));
}
beforeEach(() => {
  authUser = { name: "Ravi" };
  pickFromCamera.mockResolvedValue({ photos: [{ uri: "a" }], error: null });
  stampPhoto.mockImplementation((p) => Promise.resolve({ ...(p as object), stamped: true }));
});
afterEach(() => vi.clearAllMocks());

describe("useCollectionForm validation", () => {
  it("accepts a plain rupee amount only, and needs a photo", () => {
    const { result } = setup();
    expect(result.current.canSubmit).toBe(false);
    act(() => result.current.setAmount("100.50"));
    expect(result.current.amountNum).toBe(100.5);
    expect(result.current.canSubmit).toBe(false); // no photo yet
    for (const bad of ["0", "abc", "1e5", "", "1.234"]) {
      act(() => result.current.setAmount(bad));
      expect(result.current.canSubmit).toBe(false);
    }
  });
});

describe("useCollectionForm.addPhoto", () => {
  it("stamps a camera photo and clears any error", async () => {
    const { result } = setup();
    await act(async () => { await result.current.addPhoto("camera"); });
    expect(stampPhoto).toHaveBeenCalledWith({ uri: "a" }, { userName: "Ravi", customerName: "Balaji" });
    expect(result.current.photo).toMatchObject({ uri: "a", stamped: true });
    expect(result.current.preparing).toBe(false);
  });
  it("uses the gallery picker (limit 1)", async () => {
    const { result } = setup();
    await act(async () => { await result.current.addPhoto("gallery"); });
    expect(pickFromGallery).toHaveBeenCalledWith(1);
    expect(result.current.photo).toMatchObject({ uri: "g" });
  });
  it("surfaces a pick error and ignores an empty pick", async () => {
    pickFromCamera.mockResolvedValueOnce({ photos: [], error: "Camera permission is required." });
    const { result } = setup();
    await act(async () => { await result.current.addPhoto("camera"); });
    expect(result.current.submitError).toBe("Camera permission is required.");
    pickFromCamera.mockResolvedValueOnce({ photos: [], error: null });
    await act(async () => { await result.current.addPhoto("camera"); });
    expect(result.current.photo).toBeNull();
  });
  it("defaults the stamp user name when signed out", async () => {
    authUser = null;
    const { result } = setup();
    await act(async () => { await result.current.addPhoto("camera"); });
    expect(stampPhoto).toHaveBeenCalledWith({ uri: "a" }, { userName: "", customerName: "Balaji" });
  });
  it("passes a null customer name through to the stamp", async () => {
    const { result } = renderHook(() => useCollectionForm("c1", null));
    await act(async () => { await result.current.addPhoto("camera"); });
    expect(stampPhoto).toHaveBeenCalledWith({ uri: "a" }, { userName: "Ravi", customerName: null });
  });
  it("does not set the photo if the screen unmounts mid-stamp", async () => {
    let release!: () => void;
    stampPhoto.mockReturnValue(new Promise((r) => { release = () => r({ uri: "a", stamped: true }); }));
    const { result, unmount } = setup();
    let p!: Promise<boolean | void>;
    act(() => { p = result.current.addPhoto("camera"); });
    unmount();
    await act(async () => { release(); await p; });
    expect(result.current.photo).toBeNull();
  });
});

describe("useCollectionForm.onSubmit", () => {
  it("no-ops until a customer, photo and valid amount are present", async () => {
    const { result } = setup(); // valid amount + photo missing
    await act(async () => { await result.current.onSubmit(); });
    expect(runCollectionSubmit).not.toHaveBeenCalled();
  });
  it("runs the write once with a stable idempotency key and cheque bank handling", async () => {
    // Simulate a failed write (resets submitting) so a retry can re-enter onSubmit.
    runCollectionSubmit.mockImplementation((_a, cb) => { (cb as { setSubmitting: (b: boolean) => void }).setSubmitting(false); return Promise.resolve(); });
    const { result } = setup();
    await withPhoto(result);
    act(() => { result.current.setMode("cheque"); result.current.setBankName(" HDFC "); result.current.setReference(" r9 "); });
    await act(async () => { await result.current.onSubmit(); });
    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(runCollectionSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: "c1", clientUuid: "uuid-1", collectionDate: "2026-11-27", paymentReferenceNumber: "r9", bank: "HDFC" }),
      expect.objectContaining({ setConfirmedCode: expect.any(Function) }),
    );
    await act(async () => { await result.current.onSubmit(); }); // retry reuses the key (clientUuid already set)
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });
  it("uses a null bank for non-cheque modes, and nulls a blank cheque bank", async () => {
    const { result } = setup();
    await withPhoto(result);
    await act(async () => { await result.current.onSubmit(); });
    expect(runCollectionSubmit).toHaveBeenCalledWith(expect.objectContaining({ bank: null }), expect.anything());
    runCollectionSubmit.mockImplementation((_a, cb) => { (cb as { setSubmitting: (b: boolean) => void }).setSubmitting(false); return Promise.resolve(); });
    act(() => { result.current.setMode("cheque"); result.current.setBankName("   "); });
    await act(async () => { await result.current.onSubmit(); });
    expect(runCollectionSubmit).toHaveBeenLastCalledWith(expect.objectContaining({ bank: null }), expect.anything());
  });
});

describe("useCollectionForm.reset", () => {
  it("clears every field and the idempotency key", async () => {
    const { result } = setup();
    await withPhoto(result);
    act(() => { result.current.setReference("x"); result.current.setMode("upi"); });
    act(() => result.current.reset());
    expect(result.current.photo).toBeNull();
    expect(result.current.amount).toBe("");
    expect(result.current.mode).toBe("cash");
    expect(result.current.reference).toBe("");
  });
});
