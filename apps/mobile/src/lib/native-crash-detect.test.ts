import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { detectPreviousNativeCrash, installSessionActivityTracking } from "./native-crash-detect";

const getItemAsync = vi.fn<(...a: unknown[]) => Promise<string | null>>(() => Promise.resolve(null));
const setItemAsync = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const reportMobileError = vi.fn();
let appStateHandler: (s: string) => void = () => undefined;

vi.mock("expo-secure-store", () => ({ getItemAsync: (...a: unknown[]) => getItemAsync(...a), setItemAsync: (...a: unknown[]) => setItemAsync(...a) }));
vi.mock("react-native", () => ({ AppState: { addEventListener: (_e: string, cb: (s: string) => void) => { appStateHandler = cb; return { remove: vi.fn() }; } } }));
vi.mock("./report-error", () => ({ reportMobileError: (...a: unknown[]) => reportMobileError(...a) }));

beforeEach(() => { getItemAsync.mockResolvedValue(null); setItemAsync.mockResolvedValue(undefined); });
afterEach(() => vi.clearAllMocks());

describe("detectPreviousNativeCrash", () => {
  it("reports a probable native crash when the foreground flag survived, then re-arms it", async () => {
    getItemAsync.mockResolvedValue("1");
    await detectPreviousNativeCrash();
    expect(reportMobileError).toHaveBeenCalledWith(expect.objectContaining({ name: "NativeCrash" }), expect.objectContaining({ level: "fatal" }));
    expect(setItemAsync).toHaveBeenCalledWith("distribution_os_fg_active", "1");
  });
  it("does nothing on a clean prior shutdown", async () => {
    getItemAsync.mockResolvedValue("0");
    await detectPreviousNativeCrash();
    expect(reportMobileError).not.toHaveBeenCalled();
    expect(setItemAsync).toHaveBeenCalledWith("distribution_os_fg_active", "1");
  });
  it("tolerates a secure-store read failure", async () => {
    getItemAsync.mockRejectedValue(new Error("locked"));
    await expect(detectPreviousNativeCrash()).resolves.toBeUndefined();
    expect(reportMobileError).not.toHaveBeenCalled();
  });
  it("swallows a write failure when re-arming", async () => {
    setItemAsync.mockRejectedValue(new Error("locked"));
    await expect(detectPreviousNativeCrash()).resolves.toBeUndefined();
  });
});

describe("installSessionActivityTracking", () => {
  it("marks the flag active in the foreground and clears it otherwise", () => {
    installSessionActivityTracking();
    appStateHandler("active");
    expect(setItemAsync).toHaveBeenCalledWith("distribution_os_fg_active", "1");
    appStateHandler("background");
    expect(setItemAsync).toHaveBeenCalledWith("distribution_os_fg_active", "0");
  });
});
