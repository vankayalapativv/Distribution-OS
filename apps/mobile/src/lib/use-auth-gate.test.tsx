import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAuthGate } from "./use-auth-gate";

const replace = vi.fn();
const registerPushToken = vi.fn();
const flushPendingErrors = vi.fn();
const setErrorRoute = vi.fn();
const startSyncEngine = vi.fn();
const stopSyncEngine = vi.fn();
const hydrate = vi.fn<() => Promise<void>>(() => Promise.resolve());

type Role = "SALES_EXECUTIVE" | "LOGISTICS" | "SUPER_ADMIN";
const authState = { token: null as string | null, user: null as { role: Role } | null, hydrated: true, hydrate };
let segments: string[] = ["login"];

vi.mock("expo-router", () => ({ useRouter: () => ({ replace: (...a: unknown[]) => replace(...a) }), useSegments: () => segments }));
vi.mock("./auth", () => ({ useAuth: () => authState }));
vi.mock("./invoice-notifications", () => ({ registerPushToken: () => registerPushToken() }));
vi.mock("./report-error", () => ({ flushPendingErrors: () => flushPendingErrors(), setErrorRoute: (...a: unknown[]) => setErrorRoute(...a) }));
vi.mock("./sync", () => ({ startSyncEngine: () => startSyncEngine(), stopSyncEngine: () => stopSyncEngine() }));
vi.mock("./use-notification-router", () => ({ useNotificationRouter: () => undefined }));
vi.mock("./use-session-guard", () => ({ useSessionGuard: () => undefined }));

async function render() {
  const view = renderHook(() => useAuthGate());
  await act(async () => { await Promise.resolve(); await Promise.resolve(); }); // hydrate().finally
  return view;
}
beforeEach(() => {
  authState.token = null; authState.user = null; authState.hydrated = true;
  segments = ["login"]; hydrate.mockResolvedValue(undefined);
  vi.useFakeTimers();
});
afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); vi.clearAllMocks(); });

describe("useAuthGate routing", () => {
  it("leaves a signed-out user on the login screen, then reveals", async () => {
    const { result } = await render();
    expect(replace).not.toHaveBeenCalled();
    expect(result.current.started).toBe(true);
    act(() => vi.advanceTimersByTime(250));
    expect(result.current.revealed).toBe(true);
  });

  it("redirects a signed-out user off a protected route to /login", async () => {
    segments = ["(tabs)"];
    await render();
    expect(replace).toHaveBeenCalledWith("/login");
  });

  it("sends a signed-in SE home from login and starts the sync engine", async () => {
    authState.token = "t"; authState.user = { role: "SALES_EXECUTIVE" }; segments = ["login"];
    await render();
    expect(replace).toHaveBeenCalledWith("/(tabs)");
    expect(startSyncEngine).toHaveBeenCalled();
    expect(registerPushToken).toHaveBeenCalled();
    expect(flushPendingErrors).toHaveBeenCalled();
  });

  it("redirects a logistics user to their delivery home", async () => {
    authState.token = "t"; authState.user = { role: "LOGISTICS" }; segments = ["login"];
    await render();
    expect(replace).toHaveBeenCalledWith("/(logistics)/delivery");
  });

  it("redirects an admin out of the wrong group and stops the sync engine", async () => {
    authState.token = "t"; authState.user = { role: "SUPER_ADMIN" }; segments = ["(tabs)"];
    await render();
    expect(replace).toHaveBeenCalledWith("/(admin)");
    expect(stopSyncEngine).toHaveBeenCalled();
    expect(startSyncEngine).not.toHaveBeenCalled();
  });

  it("stays put and reveals when a user is already in their own group", async () => {
    authState.token = "t"; authState.user = { role: "LOGISTICS" }; segments = ["(logistics)"];
    const { result } = await render();
    expect(replace).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(250));
    expect(result.current.revealed).toBe(true);
  });

  it("waits for hydration before routing", async () => {
    authState.hydrated = false; authState.token = null; segments = ["(tabs)"];
    await render();
    expect(replace).not.toHaveBeenCalled(); // redirect effect bails until hydrated
  });

  it("attributes error reports to the current route", async () => {
    segments = ["(admin)", "settings"];
    await render();
    expect(setErrorRoute).toHaveBeenCalledWith("/(admin)/settings");
  });
});
