import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const apiGet = vi.fn();
const apiRequest = vi.fn();
vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiGet: (...a: unknown[]) => apiGet(...a), apiRequest: (...a: unknown[]) => apiRequest(...a) };
});
import { useReassign } from "./use-reassign";
import type { ReassignPreview } from "./reassign-api";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const ZERO = { orders: 2, collections: 0, invoices: 0, visits: 0, photos: 0, notes: 0, beatDays: 0 };
const preview: ReassignPreview = {
  customer: { id: "c1", customerCode: "VD-c1", legalName: "Balaji" },
  currentOwner: { id: "o1", name: "Priya" },
  counts: ZERO, undoable: null, history: [], salesExecutives: [{ id: "o2", name: "Vishnu" }],
};
const wrap = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { readonly children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
};
const setup = (id = "c1") =>
  renderHook(({ cid }) => useReassign(cfg, cid), { initialProps: { cid: id }, wrapper: wrap() });
beforeEach(() => { apiGet.mockReset().mockResolvedValue(preview); apiRequest.mockReset(); });
afterEach(() => vi.restoreAllMocks());
describe("useReassign", () => {
  it("loads the preview when a customer is selected", async () => {
    const { result } = setup("c1");
    await waitFor(() => expect(result.current.preview).toEqual(preview));
    expect(apiGet).toHaveBeenCalledWith(cfg, "/customers/c1/reassign/preview");
  });
  it("stays empty and fetches nothing when no customer is selected", () => {
    const { result } = setup("");
    expect(result.current.preview).toBeNull();
    expect(apiGet).not.toHaveBeenCalled();
  });
  it("surfaces a load error", async () => {
    apiGet.mockReset().mockRejectedValue(new Error("boom"));
    const { result } = setup("c1");
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.preview).toBeNull();
  });
  it("reassigns, sets a notice, and refetches", async () => {
    apiRequest.mockResolvedValue({ toUserName: "Vishnu", counts: ZERO });
    const { result } = setup("c1");
    await waitFor(() => expect(result.current.preview).toEqual(preview));
    act(() => result.current.setToUserId("o2"));
    await act(async () => { await result.current.doReassign(); });
    expect(apiRequest).toHaveBeenCalledWith(cfg, "POST", "/customers/c1/reassign", { toUserId: "o2" });
    await waitFor(() => expect(result.current.notice).toContain("Reassigned to Vishnu"));
    expect(apiGet.mock.calls.length).toBeGreaterThanOrEqual(2); // initial + refetch
  });
  it("doReassign with no target picked is a no-op; and surfaces a reassign error", async () => {
    const { result } = setup("c1");
    await waitFor(() => expect(result.current.preview).toEqual(preview));
    await act(async () => { await result.current.doReassign(); });
    expect(apiRequest).not.toHaveBeenCalled();
    apiRequest.mockRejectedValue(new Error("nope"));
    act(() => result.current.setToUserId("o2"));
    await act(async () => { await result.current.doReassign(); });
    expect(result.current.error).toBeTruthy();
  });
  it("undoes + notices, and surfaces an undo error", async () => {
    apiRequest.mockResolvedValueOnce({ fromUserName: "Priya", counts: ZERO });
    const { result } = setup("c1");
    await waitFor(() => expect(result.current.preview).toEqual(preview));
    await act(async () => { await result.current.doUndo(); });
    await waitFor(() => expect(result.current.notice).toContain("Undone"));
    apiRequest.mockRejectedValueOnce(new Error("x"));
    await act(async () => { await result.current.doUndo(); });
    expect(result.current.error).toBeTruthy();
  });
  it("falls back to generic names in the notice when the entry omits them", async () => {
    const { result } = setup("c1");
    await waitFor(() => expect(result.current.preview).toEqual(preview));
    apiRequest.mockResolvedValueOnce({ counts: ZERO });
    act(() => result.current.setToUserId("o2"));
    await act(async () => { await result.current.doReassign(); });
    await waitFor(() => expect(result.current.notice).toContain("the selected executive"));
    apiRequest.mockResolvedValueOnce({ counts: ZERO });
    await act(async () => { await result.current.doUndo(); });
    await waitFor(() => expect(result.current.notice).toContain("the previous owner"));
  });
  it("resets the picked target + messages when the selected customer changes", async () => {
    const { result, rerender } = setup("c1");
    await waitFor(() => expect(result.current.preview).toEqual(preview));
    act(() => result.current.setToUserId("o2"));
    rerender({ cid: "c2" });
    expect(result.current.toUserId).toBe("");
  });
  it("an action is a no-op while no preview is loaded (run guard)", async () => {
    const { result } = setup("");
    await act(async () => { await result.current.doUndo(); });
    expect(apiRequest).not.toHaveBeenCalled();
  });
});
