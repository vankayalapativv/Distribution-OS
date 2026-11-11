import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProofBlob } from "./use-proof-blob";

const config = { apiBaseUrl: "http://api", authToken: "tok" };

beforeEach(() => {
  vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());

describe("useProofBlob", () => {
  it("fetches the proof with the bearer token and exposes an object URL", async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(["x"])) }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useProofBlob("c1", config));
    await waitFor(() => expect(result.current.src).toBe("blob:x"));
    expect(fetchMock).toHaveBeenCalledWith("http://api/collections/c1/proof", { headers: { Authorization: "Bearer tok" } });
    expect(result.current.failed).toBe(false);
  });

  it("flags failure when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false })));
    const { result } = renderHook(() => useProofBlob("c1", config));
    await waitFor(() => expect(result.current.failed).toBe(true));
  });

  it("flags failure on a network error", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    const { result } = renderHook(() => useProofBlob("c1", config));
    await waitFor(() => expect(result.current.failed).toBe(true));
  });
});
