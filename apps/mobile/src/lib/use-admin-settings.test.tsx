import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAdminSettings } from "./use-admin-settings";

const logout = vi.fn();
const confirm = vi.fn<(...a: unknown[]) => Promise<boolean>>(() => Promise.resolve(true));
let authUser: { role: string } | null = { role: "SUPER_ADMIN" };
vi.mock("../components/dialog", () => ({ useDialog: () => ({ confirm: (...a: unknown[]) => confirm(...a) }) }));
vi.mock("./auth", () => ({ useAuth: () => ({ user: authUser, logout }) }));

beforeEach(() => { authUser = { role: "SUPER_ADMIN" }; confirm.mockResolvedValue(true); });
afterEach(() => vi.clearAllMocks());

describe("useAdminSettings", () => {
  it("title-cases the role label", () => {
    expect(renderHook(() => useAdminSettings()).result.current.roleLabel).toBe("Super Admin");
  });
  it("is blank when there is no user", () => {
    authUser = null;
    expect(renderHook(() => useAdminSettings()).result.current.roleLabel).toBe("");
  });
  it("logs out on confirm", async () => {
    const { result } = renderHook(() => useAdminSettings());
    await act(async () => { await result.current.onLogout(); });
    expect(logout).toHaveBeenCalled();
  });
  it("does not log out when cancelled", async () => {
    confirm.mockResolvedValue(false);
    const { result } = renderHook(() => useAdminSettings());
    await act(async () => { await result.current.onLogout(); });
    expect(logout).not.toHaveBeenCalled();
  });
});
