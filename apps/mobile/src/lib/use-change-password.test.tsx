import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useChangePassword } from "./use-change-password";

const back = vi.fn();
const apiFetch = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve({}));
vi.mock("expo-router", () => ({ router: { back: () => back() } }));
vi.mock("./api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("./auth", () => ({ useAuth: (sel: (s: { token: string }) => unknown) => sel({ token: "tok" }) }));

function fill(result: { current: ReturnType<typeof useChangePassword> }, c: string, n: string, cf: string) {
  act(() => { result.current.setCurrent(c); result.current.setNext(n); result.current.setConfirm(cf); });
}
beforeEach(() => { vi.useFakeTimers(); apiFetch.mockResolvedValue({}); });
afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); vi.clearAllMocks(); });

describe("useChangePassword validation", () => {
  it("flags a too-short new password and a mismatch", () => {
    const { result } = renderHook(() => useChangePassword());
    fill(result, "old", "short", "short");
    expect(result.current.tooShort).toBe(true);
    expect(result.current.canSave).toBe(false);
    fill(result, "old", "longenough", "different");
    expect(result.current.mismatch).toBe(true);
    expect(result.current.canSave).toBe(false);
  });
  it("allows save when current set, new ≥8 and confirm matches", () => {
    const { result } = renderHook(() => useChangePassword());
    fill(result, "old", "longenough", "longenough");
    expect(result.current.canSave).toBe(true);
  });
});

describe("useChangePassword.onSave", () => {
  it("no-ops when the form can't be saved", async () => {
    const { result } = renderHook(() => useChangePassword());
    await act(async () => { await result.current.onSave(); });
    expect(apiFetch).not.toHaveBeenCalled();
  });
  it("posts the change, clears fields, and routes back after the delay", async () => {
    const { result } = renderHook(() => useChangePassword());
    fill(result, "old", "longenough", "longenough");
    await act(async () => { await result.current.onSave(); });
    expect(apiFetch).toHaveBeenCalledWith("/me/change-password", expect.objectContaining({ method: "POST", body: { currentPassword: "old", newPassword: "longenough" } }));
    expect(result.current.saved).toBe(true);
    expect(result.current.current).toBe("");
    act(() => vi.advanceTimersByTime(800));
    expect(back).toHaveBeenCalled();
  });
  it("surfaces a failure (Error + non-Error)", async () => {
    apiFetch.mockRejectedValueOnce(new Error("wrong current password"));
    const { result } = renderHook(() => useChangePassword());
    fill(result, "old", "longenough", "longenough");
    await act(async () => { await result.current.onSave(); });
    expect(result.current.error).toBe("wrong current password");
    apiFetch.mockRejectedValueOnce("boom");
    fill(result, "old", "longenough", "longenough");
    await act(async () => { await result.current.onSave(); });
    expect(result.current.error).toMatch(/Could not change password/);
  });
});
