import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getNativeTracking,
  setNativeSignedIn,
  startNativeForegroundTracking,
  stopNativeForegroundTracking,
} from "./gps-native";

let platformOS = "android";
let nativeModule: Record<string, unknown> | undefined;
const getItemAsync = vi.fn<(k: string) => Promise<string | null>>(() => Promise.resolve(null));
let auth: { token: string | null; user: { role: string } | null } = { token: "tok", user: { role: "SALES_EXECUTIVE" } };

vi.mock("react-native", () => ({
  Platform: { get OS() { return platformOS; } },
  NativeModules: { get NativeTracking() { return nativeModule; } },
}));
vi.mock("expo-secure-store", () => ({ getItemAsync: (k: string) => getItemAsync(k) }));
vi.mock("./api", () => ({ API_BASE_URL: "https://api" }));
vi.mock("./auth", () => ({ useAuth: { getState: () => auth } }));
vi.mock("./day-flag", () => ({ istDate: () => "2026-08-05" }));
vi.mock("./gps-config", () => ({ SE_CUTOFF_HOUR: 20 }));
vi.mock("./gps-keys", () => ({ serverSessionKey: () => "SRV" }));

function fullNative() {
  return {
    startForegroundTracking: vi.fn(() => Promise.resolve(true)),
    stopForegroundTracking: vi.fn(() => Promise.resolve(true)),
    setSignedIn: vi.fn(() => Promise.resolve(true)),
    setUploadContext: vi.fn(() => Promise.resolve(true)),
  };
}

beforeEach(() => {
  platformOS = "android";
  nativeModule = fullNative();
  auth = { token: "tok", user: { role: "SALES_EXECUTIVE" } };
  getItemAsync.mockResolvedValue(null);
});
afterEach(() => vi.clearAllMocks());

describe("getNativeTracking", () => {
  it("returns the module on android when start+stop exist", () => {
    expect(getNativeTracking()).toBe(nativeModule);
  });
  it("returns null on non-android, when absent, or when incomplete", () => {
    platformOS = "ios";
    expect(getNativeTracking()).toBeNull();
    platformOS = "android";
    nativeModule = undefined;
    expect(getNativeTracking()).toBeNull();
    nativeModule = { startForegroundTracking: vi.fn() }; // no stop
    expect(getNativeTracking()).toBeNull();
  });
});

describe("startNativeForegroundTracking", () => {
  it("returns false without a native module", async () => {
    nativeModule = undefined;
    expect(await startNativeForegroundTracking("cs-1")).toBe(false);
  });
  it("starts an SE with the fixed 8 PM hour cap + date cap and refreshes upload context", async () => {
    const native = nativeModule as ReturnType<typeof fullNative>;
    getItemAsync.mockImplementation((k) => Promise.resolve(k === "SRV" ? "srv-1" : null));
    expect(await startNativeForegroundTracking("cs-1")).toBe(true);
    expect(native.setUploadContext).toHaveBeenCalledWith("tok", "https://api");
    expect(native.startForegroundTracking).toHaveBeenCalledWith("cs-1", "srv-1", "2026-08-05", "20");
  });
  it("gives Logistics the date cap (midnight close) but NO hour cap, and coerces the result", async () => {
    auth = { token: "tok", user: { role: "LOGISTICS" } };
    const native = nativeModule as ReturnType<typeof fullNative>;
    native.startForegroundTracking.mockResolvedValue(false);
    expect(await startNativeForegroundTracking("cs-1")).toBe(false);
    expect(native.startForegroundTracking).toHaveBeenCalledWith("cs-1", null, "2026-08-05", null);
  });
  it("returns false if the native start rejects", async () => {
    (nativeModule as ReturnType<typeof fullNative>).startForegroundTracking.mockRejectedValue(new Error("x"));
    expect(await startNativeForegroundTracking("cs-1")).toBe(false);
  });
});

describe("stopNativeForegroundTracking", () => {
  it("calls the native stop (no throw when absent)", async () => {
    const native = nativeModule as ReturnType<typeof fullNative>;
    await stopNativeForegroundTracking();
    expect(native.stopForegroundTracking).toHaveBeenCalled();
    nativeModule = undefined;
    await expect(stopNativeForegroundTracking()).resolves.toBeUndefined();
  });
});

describe("setNativeSignedIn", () => {
  it("is a no-op on non-android", async () => {
    platformOS = "ios";
    await setNativeSignedIn(true);
    expect((nativeModule as ReturnType<typeof fullNative>).setSignedIn).not.toHaveBeenCalled();
  });
  it("signs in and refreshes upload context", async () => {
    const native = nativeModule as ReturnType<typeof fullNative>;
    await setNativeSignedIn(true);
    expect(native.setSignedIn).toHaveBeenCalledWith(true);
    expect(native.setUploadContext).toHaveBeenCalledWith("tok", "https://api");
  });
  it("signs out without refreshing upload context", async () => {
    const native = nativeModule as ReturnType<typeof fullNative>;
    await setNativeSignedIn(false);
    expect(native.setSignedIn).toHaveBeenCalledWith(false);
    expect(native.setUploadContext).not.toHaveBeenCalled();
  });

  it("swallows native + SecureStore failures", async () => {
    const native = nativeModule as ReturnType<typeof fullNative>;
    getItemAsync.mockRejectedValue(new Error("x"));
    native.setUploadContext.mockRejectedValue(new Error("x"));
    native.setSignedIn.mockRejectedValue(new Error("x"));
    native.stopForegroundTracking.mockRejectedValue(new Error("x"));
    await startNativeForegroundTracking("cs"); // serverSession read + setUploadContext catches
    await stopNativeForegroundTracking(); // stop catch
    await setNativeSignedIn(true); // setSignedIn + setUploadContext catches
    // no throw
  });
});
