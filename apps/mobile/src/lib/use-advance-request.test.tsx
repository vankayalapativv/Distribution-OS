import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAdvanceRequest } from "./use-advance-request";

const h = vi.hoisted(() => ({
  back: vi.fn(),
  invalidate: vi.fn(() => Promise.resolve()),
  request: vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve({})),
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: h.invalidate }) }));
vi.mock("expo-router", () => ({ router: { back: () => h.back() } }));
vi.mock("./auth", () => ({ useAuth: (sel: (s: { token: string }) => unknown) => sel({ token: "tok" }) }));
vi.mock("./advances", () => ({ requestAdvanceApi: (...a: unknown[]) => h.request(...a) }));

beforeEach(() => { h.request.mockResolvedValue({}); });
afterEach(() => vi.clearAllMocks());

describe("useAdvanceRequest", () => {
  it("rejects a non-positive amount", async () => {
    const { result } = renderHook(() => useAdvanceRequest());
    await act(async () => { await result.current.submit(); });
    expect(result.current.error).toMatch(/greater than 0/);
    expect(h.request).not.toHaveBeenCalled();
  });

  it("sends the request, invalidates the balance, and pops", async () => {
    const { result } = renderHook(() => useAdvanceRequest());
    act(() => { result.current.setAmount("10000"); result.current.setReason("  medical  "); });
    await act(async () => { await result.current.submit(); });
    expect(h.request).toHaveBeenCalledWith("tok", 10000, "medical");
    expect(h.invalidate).toHaveBeenCalledWith({ queryKey: ["my-advances"] });
    expect(h.back).toHaveBeenCalled();
  });

  it("sends a null reason when blank", async () => {
    const { result } = renderHook(() => useAdvanceRequest());
    act(() => result.current.setAmount("5000"));
    await act(async () => { await result.current.submit(); });
    expect(h.request).toHaveBeenCalledWith("tok", 5000, null);
  });

  it("surfaces an error and a generic fallback", async () => {
    h.request.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useAdvanceRequest());
    act(() => result.current.setAmount("5000"));
    await act(async () => { await result.current.submit(); });
    expect(result.current.error).toBe("offline");
    expect(h.back).not.toHaveBeenCalled();
    h.request.mockRejectedValueOnce("boom");
    await act(async () => { await result.current.submit(); });
    expect(result.current.error).toMatch(/Could not send/);
  });

  it("ignores a submit already in flight", async () => {
    let release!: () => void;
    h.request.mockReturnValueOnce(new Promise((r) => { release = () => r({}); }));
    const { result } = renderHook(() => useAdvanceRequest());
    act(() => result.current.setAmount("5000"));
    let first!: Promise<void>;
    act(() => { first = result.current.submit(); });
    await act(async () => { await result.current.submit(); }); // busy guard
    expect(h.request).toHaveBeenCalledTimes(1);
    await act(async () => { release(); await first; });
  });
});
