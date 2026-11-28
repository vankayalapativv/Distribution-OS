import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useClaimForm } from "./use-claim-form";

const h = vi.hoisted(() => ({
  token: { value: "tok" as string | null },
  params: { value: {} as { id?: string } },
  cats: { data: [{ id: "c1", name: "Fuel" }] as unknown, isPending: false },
  cache: { value: [] as unknown[] },
  editClaim: { value: undefined as unknown }, // by-id fetch result (cold cache)
  back: vi.fn(),
  invalidate: vi.fn(() => Promise.resolve()),
  submit: vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve()),
  resubmit: vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve({})),
  fetchClaim: vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve({})),
  camera: vi.fn<() => Promise<{ photos: { uri: string }[]; error: string | null }>>(),
  gallery: vi.fn<() => Promise<{ photos: { uri: string }[]; error: string | null }>>(),
}));

vi.mock("expo-crypto", () => ({ randomUUID: () => "uuid-1" }));
vi.mock("@tanstack/react-query", () => ({
  // The claim-by-id query seeds from initialData (list cache) and falls back to
  // h.editClaim (a simulated by-id fetch); the categories query returns h.cats.
  useQuery: (c: { queryKey?: unknown[]; queryFn?: () => unknown; initialData?: () => unknown }) => {
    c?.queryFn?.();
    if (Array.isArray(c.queryKey) && c.queryKey[0] === "claim") {
      return { data: c.initialData?.() ?? h.editClaim.value, isPending: false };
    }
    return { data: h.cats.data, isPending: h.cats.isPending };
  },
  useQueryClient: () => ({ getQueryData: () => h.cache.value, invalidateQueries: h.invalidate }),
}));
vi.mock("expo-router", () => ({ useLocalSearchParams: () => h.params.value, router: { back: () => h.back() } }));
vi.mock("./auth", () => ({ useAuth: (sel: (s: { token: string | null }) => unknown) => sel({ token: h.token.value }) }));
vi.mock("./expense-claims", () => ({
  fetchClaimCategories: vi.fn(),
  fetchClaim: (...a: unknown[]) => h.fetchClaim(...a),
  submitExpenseClaim: (...a: unknown[]) => h.submit(...a),
  resubmitClaim: (...a: unknown[]) => h.resubmit(...a),
}));
vi.mock("./photo-picker", () => ({ pickFromCamera: () => h.camera(), pickFromGallery: () => h.gallery() }));

beforeEach(() => {
  h.token.value = "tok"; h.params.value = {}; h.cache.value = []; h.editClaim.value = undefined; h.cats.data = [{ id: "c1", name: "Fuel" }]; h.cats.isPending = false;
  h.camera.mockResolvedValue({ photos: [{ uri: "file:///r.jpg" }], error: null });
  h.gallery.mockResolvedValue({ photos: [{ uri: "file:///g.jpg" }], error: null });
});
afterEach(() => vi.clearAllMocks());

const fill = (r: { current: ReturnType<typeof useClaimForm> }) => {
  act(() => { r.current.setCategoryId("c1"); r.current.setAmount("450"); });
};

describe("useClaimForm — new", () => {
  it("defaults the form and exposes categories", () => {
    const { result } = renderHook(() => useClaimForm());
    expect(result.current.editId).toBeNull();
    expect(result.current.categories).toEqual([{ id: "c1", name: "Fuel" }]);
    expect(result.current.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("captures a receipt from camera and gallery, and surfaces a picker error", async () => {
    const { result } = renderHook(() => useClaimForm());
    await act(async () => { await result.current.pickReceipt("camera"); });
    expect(result.current.receiptUri).toBe("file:///r.jpg");
    await act(async () => { await result.current.pickReceipt("gallery"); });
    expect(result.current.receiptUri).toBe("file:///g.jpg");
    h.camera.mockResolvedValue({ photos: [], error: "Camera permission is required." });
    await act(async () => { await result.current.pickReceipt("camera"); });
    expect(result.current.error).toMatch(/permission/);
  });

  it("ignores a cancelled pick (no photo, no error)", async () => {
    h.camera.mockResolvedValue({ photos: [], error: null });
    const { result } = renderHook(() => useClaimForm());
    await act(async () => { await result.current.pickReceipt("camera"); });
    expect(result.current.receiptUri).toBeNull();
  });

  it("surfaces a gallery permission error too", async () => {
    h.gallery.mockResolvedValue({ photos: [], error: "Photo library permission is required." });
    const { result } = renderHook(() => useClaimForm());
    await act(async () => { await result.current.pickReceipt("gallery"); });
    expect(result.current.error).toMatch(/library/);
    expect(result.current.receiptUri).toBeNull();
  });

  it("validates category, amount and receipt before submitting", async () => {
    const { result } = renderHook(() => useClaimForm());
    await act(async () => { await result.current.save(); });
    expect(result.current.error).toMatch(/category/);
    act(() => result.current.setCategoryId("c1"));
    await act(async () => { await result.current.save(); });
    expect(result.current.error).toMatch(/greater than 0/);
    act(() => result.current.setAmount("450"));
    await act(async () => { await result.current.save(); });
    expect(result.current.error).toMatch(/receipt/);
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("submits a valid claim, invalidates the list and pops", async () => {
    const { result } = renderHook(() => useClaimForm());
    fill(result);
    act(() => result.current.setRemarks("toll")); // exercise the remarks || null branch
    await act(async () => { await result.current.pickReceipt("camera"); });
    await act(async () => { await result.current.save(); });
    expect(h.submit).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: "c1", amount: 450, remarks: "toll", receiptUri: "file:///r.jpg", clientUuid: "uuid-1" }),
      "tok",
    );
    expect(h.invalidate).toHaveBeenCalledWith({ queryKey: ["my-claims"] });
    expect(h.back).toHaveBeenCalled();
  });

  it("surfaces a submit error and clears busy", async () => {
    h.submit.mockRejectedValueOnce(new Error("network down"));
    const { result } = renderHook(() => useClaimForm());
    fill(result);
    await act(async () => { await result.current.pickReceipt("camera"); });
    await act(async () => { await result.current.save(); });
    expect(result.current.error).toBe("network down");
    expect(h.back).not.toHaveBeenCalled();
  });

  it("uses a generic message for a non-Error failure", async () => {
    h.submit.mockRejectedValueOnce("boom");
    const { result } = renderHook(() => useClaimForm());
    fill(result);
    await act(async () => { await result.current.pickReceipt("camera"); });
    await act(async () => { await result.current.save(); });
    expect(result.current.error).toMatch(/Could not submit/);
  });

  it("ignores a second save while one is in flight", async () => {
    let release!: () => void;
    h.submit.mockReturnValueOnce(new Promise<void>((r) => { release = r; }));
    const { result } = renderHook(() => useClaimForm());
    fill(result);
    await act(async () => { await result.current.pickReceipt("camera"); });
    let first!: Promise<void>;
    act(() => { first = result.current.save(); }); // sets busy = true
    await act(async () => { await result.current.save(); }); // busy guard → no-op
    expect(h.submit).toHaveBeenCalledTimes(1);
    await act(async () => { release(); await first; });
  });
});

describe("useClaimForm — edit", () => {
  it("prefills from the cached claim and resubmits (no receipt needed)", async () => {
    h.params.value = { id: "r1" };
    h.cache.value = [{ id: "r1", categoryId: "c1", amount: 300, date: "2026-11-20", remarks: "old", status: "submitted" }];
    const { result } = renderHook(() => useClaimForm());
    expect(result.current.editId).toBe("r1");
    expect(result.current.editStatus).toBe("submitted");
    expect(result.current.categoryId).toBe("c1");
    expect(result.current.amount).toBe("300");
    await act(async () => { await result.current.save(); });
    expect(h.resubmit).toHaveBeenCalledWith("r1", expect.objectContaining({ categoryId: "c1", amount: 300 }), "tok");
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("prefills a claim that has no remarks", async () => {
    h.params.value = { id: "r2" };
    h.cache.value = [{ id: "r2", categoryId: "c1", amount: 50, date: "2026-11-20", remarks: null }];
    const { result } = renderHook(() => useClaimForm());
    expect(result.current.remarks).toBe("");
  });

  it("tolerates an empty/absent claims cache", async () => {
    h.params.value = { id: "gone" };
    h.cache.value = undefined as unknown as unknown[]; // getQueryData → undefined → ?? []
    const { result } = renderHook(() => useClaimForm());
    expect(result.current.categoryId).toBeNull();
  });

  it("fetches the claim by id when it isn't in the list cache, normalizing the date", () => {
    h.params.value = { id: "r5" };
    h.cache.value = []; // cold cache — not found
    h.editClaim.value = { id: "r5", categoryId: "c1", amount: 120, date: "2026-11-20T00:00:00.000Z", remarks: null, status: "rejected", hasReceipt: true };
    const { result } = renderHook(() => useClaimForm());
    expect(h.fetchClaim).toHaveBeenCalledWith("r5", "tok");
    expect(result.current.categoryId).toBe("c1");
    expect(result.current.amount).toBe("120");
    expect(result.current.date).toBe("2026-11-20"); // ISO timestamp → YYYY-MM-DD
    expect(result.current.editStatus).toBe("rejected");
    expect(result.current.editHasReceipt).toBe(true);
  });

  it("does not re-prefill after the first pass", () => {
    h.params.value = { id: "r1" };
    h.cache.value = [{ id: "r1", categoryId: "c1", amount: 300, date: "2026-11-20", remarks: "old" }];
    const { result, rerender } = renderHook(() => useClaimForm());
    act(() => result.current.setCategoryId("c2")); // user override
    rerender(); // effect re-runs with prefilled=true → must NOT reset
    expect(result.current.categoryId).toBe("c2");
  });

  it("defaults categories to an empty list when none load", () => {
    h.cats.data = undefined;
    const { result } = renderHook(() => useClaimForm());
    expect(result.current.categories).toEqual([]);
  });

  it("exposes the attached receipt as an authed, cache-busted bill URL", () => {
    h.params.value = { id: "r3" };
    h.cache.value = [{ id: "r3", categoryId: "c1", amount: 80, date: "2026-11-20", remarks: null, status: "rejected", hasReceipt: true }];
    const { result } = renderHook(() => useClaimForm());
    expect(result.current.editHasReceipt).toBe(true);
    expect(result.current.authHeaders).toEqual({ Authorization: "Bearer tok" });
    expect(result.current.billUri).toMatch(/\/expense-claims\/r3\/bill\?t=\d+$/);
  });

  it("omits auth headers when there is no token", () => {
    h.token.value = null;
    h.params.value = { id: "r3" };
    h.cache.value = [{ id: "r3", categoryId: "c1", amount: 80, date: "2026-11-20", remarks: null, status: "rejected", hasReceipt: true }];
    const { result } = renderHook(() => useClaimForm());
    expect(result.current.authHeaders).toBeUndefined();
  });

  it("has no bill URL for a claim without a receipt", () => {
    h.params.value = { id: "r4" };
    h.cache.value = [{ id: "r4", categoryId: "c1", amount: 80, date: "2026-11-20", remarks: null, status: "submitted", hasReceipt: false }];
    const { result } = renderHook(() => useClaimForm());
    expect(result.current.editHasReceipt).toBe(false);
    expect(result.current.billUri).toBeNull();
  });
});
