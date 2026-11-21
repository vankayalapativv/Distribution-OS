import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBillBlob } from "./use-bill-blob";

const config = { apiBaseUrl: "https://api.test", authToken: "tok" };
const revoke = vi.fn();

beforeEach(() => {
  vi.stubGlobal("URL", { createObjectURL: () => "blob:x", revokeObjectURL: revoke });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("useBillBlob", () => {
  it("is idle with no entry", () => {
    const { result } = renderHook(() => useBillBlob(config, null));
    expect(result.current.src).toBeNull();
    expect(result.current.failed).toBe(false);
  });

  it("fetches an image bill into an object URL", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(["x"], { type: "image/png" })) }));
    const { result } = renderHook(() => useBillBlob(config, "e1"));
    await waitFor(() => expect(result.current.src).toBe("blob:x"));
    expect(result.current.isPdf).toBe(false);
  });

  it("flags a PDF bill", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(["x"], { type: "application/pdf" })) }));
    const { result } = renderHook(() => useBillBlob(config, "e1"));
    await waitFor(() => expect(result.current.isPdf).toBe(true));
  });

  it("marks failed on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const { result } = renderHook(() => useBillBlob(config, "e1"));
    await waitFor(() => expect(result.current.failed).toBe(true));
  });

  it("marks failed when the fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const { result } = renderHook(() => useBillBlob(config, "e1"));
    await waitFor(() => expect(result.current.failed).toBe(true));
  });

  const flush = () => new Promise((r) => setTimeout(r, 0));

  it("ignores a resolved bill after the hook unmounts (cancelled)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let resolveFetch!: (v: any) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise((res) => { resolveFetch = res; })));
    const { result, unmount } = renderHook(() => useBillBlob(config, "e1"));
    unmount(); // cancelled = true before the fetch resolves
    resolveFetch({ ok: true, blob: () => Promise.resolve(new Blob(["x"], { type: "image/png" })) });
    await flush();
    expect(result.current.src).toBeNull(); // the cancelled guard short-circuited
  });

  it("ignores a rejected fetch after the hook unmounts (cancelled)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rejectFetch!: (e: any) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise((_res, rej) => { rejectFetch = rej; })));
    const { result, unmount } = renderHook(() => useBillBlob(config, "e1"));
    unmount();
    rejectFetch(new Error("network"));
    await flush();
    expect(result.current.failed).toBe(false); // cancelled → failed not set
  });

  it("resets src/isPdf/failed synchronously when the entry changes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(["x"], { type: "image/png" })) }));
    const { result, rerender } = renderHook(({ id }) => useBillBlob(config, id), { initialProps: { id: "e1" } });
    await waitFor(() => expect(result.current.src).toBe("blob:x"));
    rerender({ id: "e2" }); // different entry → the render-time reset block runs
    expect(result.current.src).toBeNull();
    expect(result.current.isPdf).toBe(false);
    expect(result.current.failed).toBe(false);
  });
});
