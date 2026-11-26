import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useEditProfile } from "./use-edit-profile";

interface Profile { id: string; name: string; email: string | null; phone: string | null }

const back = vi.fn();
const apiFetch = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve({ name: "New" }));
const updateUser = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const h = vi.hoisted(() => {
  const state = { data: undefined as unknown };
  const useQuery = vi.fn((_c: unknown) => ({ data: state.data }));
  return { state, useQuery };
});

vi.mock("@tanstack/react-query", () => ({ useQuery: (c: unknown) => h.useQuery(c) }));
vi.mock("expo-router", () => ({ router: { back: () => back() } }));
vi.mock("../components/phone-field", () => ({
  toLocalPhone: (p: string | null) => (p ?? "").replace(/\D/g, "").slice(-10),
  toStoredPhone: (p: string) => (p ? `+91${p}` : null),
}));
vi.mock("./api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("./auth", () => ({ useAuth: (sel: (s: { token: string; updateUser: unknown }) => unknown) => sel({ token: "tok", updateUser }) }));

const prof: Profile = { id: "u1", name: "Old Name", email: "a@b.c", phone: "+919876543210" };
beforeEach(() => { vi.useFakeTimers(); h.state.data = prof; apiFetch.mockResolvedValue({ name: "New Name" }); });
afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); vi.clearAllMocks(); });

describe("useEditProfile query + seed", () => {
  it("configures the profile query and seeds the form from it", () => {
    const { result } = renderHook(() => useEditProfile());
    const cfg = h.useQuery.mock.calls.at(-1)![0] as { queryKey: unknown[]; enabled: boolean; queryFn: () => unknown };
    expect(cfg).toMatchObject({ queryKey: ["me", "profile"], enabled: true });
    cfg.queryFn();
    expect(apiFetch).toHaveBeenCalledWith("/me/profile", { token: "tok" });
    expect(result.current.name).toBe("Old Name");
    expect(result.current.phone).toBe("9876543210");
    expect(result.current.canSave).toBe(false); // not dirty yet
  });
  it("leaves the form empty until the profile loads, and defaults a null name", () => {
    h.state.data = undefined;
    const { result, rerender } = renderHook(() => useEditProfile());
    expect(result.current.name).toBe(""); // seed effect skipped while unloaded
    h.state.data = { id: "u1", name: null as unknown as string, email: null, phone: null };
    rerender();
    expect(result.current.name).toBe("");
    expect(result.current.phone).toBe("");
  });
});

describe("useEditProfile editing", () => {
  it("becomes dirty + saveable on a name change and clears the error", () => {
    const { result } = renderHook(() => useEditProfile());
    act(() => result.current.onNameChange("New Name"));
    expect(result.current.canSave).toBe(true);
  });
  it("flags a phone-conflict error", async () => {
    apiFetch.mockRejectedValue(new Error("That phone number is already used."));
    const { result } = renderHook(() => useEditProfile());
    act(() => result.current.onNameChange("New Name"));
    await act(async () => { await result.current.onSave(); });
    expect(result.current.phoneConflict).toBe(true);
    act(() => result.current.onPhoneChange("9999999999"));
    expect(result.current.error).toBeNull(); // change clears it
  });
});

describe("useEditProfile.onSave", () => {
  it("no-ops when the form isn't saveable", async () => {
    const { result } = renderHook(() => useEditProfile());
    await act(async () => { await result.current.onSave(); });
    expect(apiFetch).not.toHaveBeenCalledWith("/me/profile", expect.objectContaining({ method: "PATCH" }));
  });
  it("rejects an incomplete phone number", async () => {
    const { result } = renderHook(() => useEditProfile());
    act(() => { result.current.onNameChange("New Name"); result.current.onPhoneChange("12345"); });
    await act(async () => { await result.current.onSave(); });
    expect(result.current.error).toMatch(/valid 10-digit/);
  });
  it("patches the profile, updates the user, and routes back", async () => {
    const { result } = renderHook(() => useEditProfile());
    act(() => result.current.onNameChange("New Name"));
    await act(async () => { await result.current.onSave(); });
    expect(apiFetch).toHaveBeenCalledWith("/me/profile", expect.objectContaining({ method: "PATCH", body: { name: "New Name", phone: "+919876543210" } }));
    expect(updateUser).toHaveBeenCalledWith({ name: "New Name" });
    expect(result.current.saved).toBe(true);
    act(() => vi.advanceTimersByTime(600));
    expect(back).toHaveBeenCalled();
  });
  it("surfaces a save failure (Error + non-Error)", async () => {
    apiFetch.mockRejectedValueOnce(new Error("server down"));
    const { result } = renderHook(() => useEditProfile());
    act(() => result.current.onNameChange("New Name"));
    await act(async () => { await result.current.onSave(); });
    expect(result.current.error).toBe("server down");
    apiFetch.mockRejectedValueOnce("boom");
    act(() => result.current.onNameChange("Another Name"));
    await act(async () => { await result.current.onSave(); });
    expect(result.current.error).toMatch(/Could not save/);
  });
});
