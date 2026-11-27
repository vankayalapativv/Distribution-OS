import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { passwordRules, passwordStrength, useChangePassword } from "./use-change-password";

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

describe("passwordRules + passwordStrength", () => {
  it("requires 8+ chars with a letter and a number", () => {
    expect(passwordRules("")).toMatchObject({ longEnough: false, hasLetter: false, hasNumber: false, ok: false });
    expect(passwordRules("abcdefgh")).toMatchObject({ longEnough: true, hasNumber: false, ok: false });
    expect(passwordRules("12345678")).toMatchObject({ hasLetter: false, ok: false });
    expect(passwordRules("abcd123")).toMatchObject({ longEnough: false, ok: false });
    expect(passwordRules("abcd1234").ok).toBe(true);
  });
  it("scores strength 0–4", () => {
    expect(passwordStrength("")).toBe(0);
    expect(passwordStrength("abc")).toBe(0); // non-empty but under every threshold
    expect(passwordStrength("abcdefgh")).toBe(1); // length only
    expect(passwordStrength("abcd1234")).toBe(2); // length + variety
    expect(passwordStrength("abcdefgh1234")).toBe(3); // +12 length
    expect(passwordStrength("abcdefghij1!")).toBe(4); // +symbol +12 length
  });
});

describe("useChangePassword validation", () => {
  it("surfaces the rule flags and blocks save until all pass", () => {
    const { result } = renderHook(() => useChangePassword());
    fill(result, "old", "abcdefgh", "abcdefgh"); // no number
    expect(result.current.rules.hasNumber).toBe(false);
    expect(result.current.canSave).toBe(false);
    fill(result, "old", "abcd1234", "different"); // mismatch
    expect(result.current.mismatch).toBe(true);
    expect(result.current.canSave).toBe(false);
    fill(result, "old", "abcd1234", "abcd1234");
    expect(result.current.canSave).toBe(true);
    expect(result.current.strength).toBeGreaterThan(0);
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
    fill(result, "old", "abcd1234", "abcd1234");
    await act(async () => { await result.current.onSave(); });
    expect(apiFetch).toHaveBeenCalledWith("/me/change-password", expect.objectContaining({ method: "POST", body: { currentPassword: "old", newPassword: "abcd1234" } }));
    expect(result.current.saved).toBe(true);
    expect(result.current.current).toBe("");
    act(() => vi.advanceTimersByTime(900));
    expect(back).toHaveBeenCalled();
  });
  it("flags a wrong current password inline, and clears the error on edit", async () => {
    apiFetch.mockRejectedValueOnce(new Error("Your current password is incorrect."));
    const { result } = renderHook(() => useChangePassword());
    fill(result, "old", "abcd1234", "abcd1234");
    await act(async () => { await result.current.onSave(); });
    expect(result.current.wrongCurrent).toBe(true);
    act(() => result.current.setCurrent("old2")); // typing clears the stale error
    expect(result.current.error).toBeNull();
    expect(result.current.wrongCurrent).toBe(false);
  });
  it("falls back to a generic message for a non-Error throw", async () => {
    apiFetch.mockRejectedValueOnce("boom");
    const { result } = renderHook(() => useChangePassword());
    fill(result, "old", "abcd1234", "abcd1234");
    await act(async () => { await result.current.onSave(); });
    expect(result.current.error).toMatch(/Could not change password/);
  });
});
