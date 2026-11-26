import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSessionGuard } from "./use-session-guard";

const h = vi.hoisted(() => {
  const expireSession = vi.fn<() => Promise<void>>(() => Promise.resolve());
  const applyRefreshedToken = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
  const state = { token: "tok" as string | null, expireSession, applyRefreshedToken };
  const useAuth = Object.assign((sel: (s: typeof state) => unknown) => sel(state), { getState: () => state });
  return { state, expireSession, applyRefreshedToken, useAuth };
});
const { state, expireSession, applyRefreshedToken } = h;
const storageGet = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve("sess-1"));
const neonProbeSession = vi.fn<(...a: unknown[]) => Promise<{ status: string; token?: string }>>(() => Promise.resolve({ status: "unavailable" }));
let appStateHandler: (s: string) => void = () => undefined;
const removeSub = vi.fn();

vi.mock("./auth", () => ({ useAuth: h.useAuth }));
vi.mock("react-native", () => ({ AppState: { addEventListener: (_e: string, cb: (s: string) => void) => { appStateHandler = cb; return { remove: removeSub }; } } }));
vi.mock("./auth-storage", () => ({ SESSION_KEY: "SESSION", storage: { get: (...a: unknown[]) => storageGet(...a) } }));
vi.mock("./neon-auth", () => ({ neonProbeSession: (...a: unknown[]) => neonProbeSession(...a) }));

const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }); };
beforeEach(() => {
  state.token = "tok";
  storageGet.mockResolvedValue("sess-1");
  neonProbeSession.mockResolvedValue({ status: "unavailable" });
});
afterEach(() => vi.clearAllMocks());

describe("useSessionGuard", () => {
  it("does not probe when signed out", async () => {
    state.token = null;
    renderHook(() => useSessionGuard());
    await flush();
    expect(neonProbeSession).not.toHaveBeenCalled();
  });

  it("logs the user out on a definitive revocation", async () => {
    neonProbeSession.mockResolvedValue({ status: "revoked" });
    renderHook(() => useSessionGuard());
    await flush();
    expect(expireSession).toHaveBeenCalled();
  });

  it("adopts a refreshed token while the session is active", async () => {
    neonProbeSession.mockResolvedValue({ status: "active", token: "fresh" });
    renderHook(() => useSessionGuard());
    await flush();
    expect(applyRefreshedToken).toHaveBeenCalledWith("fresh");
  });

  it("leaves auth untouched when the probe is inconclusive (offline)", async () => {
    neonProbeSession.mockResolvedValue({ status: "unavailable" });
    renderHook(() => useSessionGuard());
    await flush();
    expect(expireSession).not.toHaveBeenCalled();
    expect(applyRefreshedToken).not.toHaveBeenCalled();
  });

  it("skips the probe when there is no stored session", async () => {
    storageGet.mockResolvedValue(null);
    renderHook(() => useSessionGuard());
    await flush();
    expect(neonProbeSession).not.toHaveBeenCalled();
  });

  it("bails if the user logs out mid-probe", async () => {
    neonProbeSession.mockImplementation(async () => { state.token = null; return { status: "revoked" }; });
    renderHook(() => useSessionGuard());
    await flush();
    expect(expireSession).not.toHaveBeenCalled(); // token gone → bail before acting
  });

  it("swallows an unexpected probe error", async () => {
    neonProbeSession.mockRejectedValue(new Error("boom"));
    renderHook(() => useSessionGuard());
    await flush();
    expect(expireSession).not.toHaveBeenCalled();
  });

  it("re-probes when the app returns to the foreground", async () => {
    renderHook(() => useSessionGuard());
    await flush();
    neonProbeSession.mockClear();
    act(() => appStateHandler("active"));
    await flush();
    expect(neonProbeSession).toHaveBeenCalled();
    neonProbeSession.mockClear();
    act(() => appStateHandler("background")); // ignored
    await flush();
    expect(neonProbeSession).not.toHaveBeenCalled();
  });

  it("ignores a re-entrant check while one is already running", async () => {
    let release!: () => void;
    neonProbeSession.mockReturnValue(new Promise((r) => { release = () => r({ status: "unavailable" }); }));
    renderHook(() => useSessionGuard());
    await act(async () => { await Promise.resolve(); }); // first probe in flight (running=true)
    neonProbeSession.mockClear();
    act(() => appStateHandler("active")); // re-entrant → guarded out
    expect(neonProbeSession).not.toHaveBeenCalled();
    await act(async () => { release(); await Promise.resolve(); });
  });

  it("bails at the start when the token was cleared before the check ran", async () => {
    renderHook(() => useSessionGuard());
    await flush();
    state.token = null; // signed out between scheduling and running
    storageGet.mockClear();
    act(() => appStateHandler("active"));
    await flush();
    expect(storageGet).not.toHaveBeenCalled();
  });

  it("stops after storage read when unmounted before the probe", async () => {
    let releaseStorage!: () => void;
    storageGet.mockReturnValue(new Promise((r) => { releaseStorage = () => r("sess-1"); }));
    const { unmount } = renderHook(() => useSessionGuard());
    await act(async () => { await Promise.resolve(); }); // storage.get in flight
    unmount(); // cancelled = true
    await act(async () => { releaseStorage(); await Promise.resolve(); await Promise.resolve(); });
    expect(neonProbeSession).not.toHaveBeenCalled(); // bailed at the post-read cancelled check
  });

  it("skips the reschedule when unmounted mid-probe", async () => {
    let release!: () => void;
    neonProbeSession.mockReturnValue(new Promise((r) => { release = () => r({ status: "unavailable" }); }));
    const { unmount } = renderHook(() => useSessionGuard());
    await act(async () => { await Promise.resolve(); });
    unmount();
    await act(async () => { release(); await Promise.resolve(); await Promise.resolve(); });
    expect(removeSub).toHaveBeenCalled();
  });

  it("re-probes on the idle interval and cleans up on unmount", async () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useSessionGuard());
    await act(async () => { await vi.advanceTimersByTimeAsync(0); }); // initial runCheck settles
    neonProbeSession.mockClear();
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); }); // idle tick
    expect(neonProbeSession).toHaveBeenCalled();
    unmount();
    expect(removeSub).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
