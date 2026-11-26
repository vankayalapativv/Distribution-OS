import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useLoginForm } from "./use-login-form";

const login = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const getIsOnline = vi.fn<() => boolean>(() => true);
const humanizeError = vi.fn<(...a: unknown[]) => { title: string; message: string; severity: string }>(() => ({ title: "Oops", message: "bad", severity: "error" }));
vi.mock("./auth", () => ({ useAuth: (sel: (s: { login: unknown }) => unknown) => sel({ login }) }));
vi.mock("./connectivity", () => ({ getIsOnline: () => getIsOnline() }));
vi.mock("./humanize-error", () => ({ humanizeError: (...a: unknown[]) => humanizeError(...a) }));

beforeEach(() => { login.mockResolvedValue(undefined); });
afterEach(() => vi.clearAllMocks());

describe("useLoginForm validation", () => {
  it("requires an identifier and password", async () => {
    const { result } = renderHook(() => useLoginForm());
    await act(async () => { await result.current.onSubmit(); });
    expect(result.current.fieldErrors).toEqual({ email: "Email or phone is required.", password: "Password is required." });
    expect(login).not.toHaveBeenCalled();
  });
  it("rejects a malformed identifier (not an email, under 10 digits)", async () => {
    const { result } = renderHook(() => useLoginForm());
    act(() => { result.current.onEmailChange("nope"); result.current.onPasswordChange("pw"); });
    await act(async () => { await result.current.onSubmit(); });
    expect(result.current.fieldErrors.email).toMatch(/valid email or 10-digit phone/);
  });
  it("accepts a 10-digit phone identifier", async () => {
    const { result } = renderHook(() => useLoginForm());
    act(() => { result.current.onEmailChange("9876543210"); result.current.onPasswordChange("pw"); });
    await act(async () => { await result.current.onSubmit(); });
    expect(login).toHaveBeenCalledWith("9876543210", "pw");
  });
});

describe("useLoginForm change handlers", () => {
  it("clears the email error on change and toggles password visibility", async () => {
    const { result } = renderHook(() => useLoginForm());
    await act(async () => { await result.current.onSubmit(); }); // sets both errors
    act(() => result.current.onEmailChange("a@b.co"));
    expect(result.current.fieldErrors.email).toBeUndefined();
    act(() => result.current.onPasswordChange("secret"));
    expect(result.current.fieldErrors.password).toBeUndefined();
    act(() => result.current.toggleShow());
    expect(result.current.showPassword).toBe(true);
  });
});

describe("useLoginForm.onSubmit", () => {
  it("logs in with a valid email + password", async () => {
    const { result } = renderHook(() => useLoginForm());
    act(() => { result.current.onEmailChange(" a@b.co "); result.current.onPasswordChange("secret"); });
    await act(async () => { await result.current.onSubmit(); });
    expect(login).toHaveBeenCalledWith("a@b.co", "secret");
    expect(result.current.busy).toBe(false);
  });
  it("surfaces a friendly error when login fails", async () => {
    login.mockRejectedValue(new Error("401"));
    getIsOnline.mockReturnValue(false);
    const { result } = renderHook(() => useLoginForm());
    act(() => { result.current.onEmailChange("a@b.co"); result.current.onPasswordChange("secret"); });
    await act(async () => { await result.current.onSubmit(); });
    expect(humanizeError).toHaveBeenCalledWith(expect.any(Error), { online: false });
    expect(result.current.feedback).toMatchObject({ title: "Oops" });
  });
  it("ignores a re-entrant submit while busy", async () => {
    let release!: () => void;
    login.mockReturnValue(new Promise<void>((r) => { release = r; }));
    const { result } = renderHook(() => useLoginForm());
    act(() => { result.current.onEmailChange("a@b.co"); result.current.onPasswordChange("secret"); });
    let first!: Promise<void>;
    act(() => { first = result.current.onSubmit(); });
    await act(async () => { await result.current.onSubmit(); }); // guarded by busy
    expect(login).toHaveBeenCalledTimes(1);
    await act(async () => { release(); await first; });
  });
});
