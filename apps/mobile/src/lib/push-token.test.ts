import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getPermissionsAsync = vi.fn<() => Promise<{ granted: boolean; canAskAgain: boolean }>>(() => Promise.resolve({ granted: true, canAskAgain: true }));
const requestPermissionsAsync = vi.fn<() => Promise<{ granted: boolean; canAskAgain: boolean }>>(() => Promise.resolve({ granted: true, canAskAgain: true }));
const getExpoPushTokenAsync = vi.fn<(...a: unknown[]) => Promise<{ data: string }>>(() => Promise.resolve({ data: "ExpoToken[xyz]" }));
const apiFetch = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve({}));
const device = { manufacturer: "Samsung" as string | null, modelName: "SM-G991B" as string | null };
let token: string | null = "tok";

async function load(projectId: string | undefined) {
  vi.resetModules();
  vi.doMock("expo-constants", () => ({ default: { expoConfig: { extra: { eas: { projectId } } } } }));
  vi.doMock("expo-device", () => ({ get manufacturer() { return device.manufacturer; }, get modelName() { return device.modelName; } }));
  vi.doMock("expo-notifications", () => ({
    getPermissionsAsync: () => getPermissionsAsync(),
    requestPermissionsAsync: () => requestPermissionsAsync(),
    getExpoPushTokenAsync: (...a: unknown[]) => getExpoPushTokenAsync(...a),
  }));
  vi.doMock("react-native", () => ({ Platform: { OS: "android" } }));
  vi.doMock("./api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
  vi.doMock("./auth", () => ({ useAuth: { getState: () => ({ token }) } }));
  return (await import("./push-token")).registerPushToken;
}

beforeEach(() => {
  token = "tok";
  device.manufacturer = "Samsung"; device.modelName = "SM-G991B";
  getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
  requestPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
  getExpoPushTokenAsync.mockResolvedValue({ data: "ExpoToken[xyz]" });
});
afterEach(() => { vi.clearAllMocks(); vi.resetModules(); });

describe("registerPushToken", () => {
  it("does nothing when signed out", async () => {
    token = null;
    await (await load("proj-1"))();
    expect(getPermissionsAsync).not.toHaveBeenCalled();
  });

  it("registers the token + device when permission is already granted", async () => {
    await (await load("proj-1"))();
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
    expect(getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: "proj-1" });
    expect(apiFetch).toHaveBeenCalledWith("/me/push-token", expect.objectContaining({
      method: "POST",
      body: expect.objectContaining({ token: "ExpoToken[xyz]", platform: "android", manufacturer: "Samsung", model: "SM-G991B" }),
    }));
  });

  it("prompts when not yet granted but askable, then registers", async () => {
    getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    requestPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
    await (await load("proj-1"))();
    expect(requestPermissionsAsync).toHaveBeenCalled();
    expect(apiFetch).toHaveBeenCalled();
  });

  it("stops when the prompt is declined", async () => {
    getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    requestPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });
    await (await load("proj-1"))();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("does not re-prompt when permission is permanently denied", async () => {
    getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });
    await (await load("proj-1"))();
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("skips silently when the app config has no EAS projectId", async () => {
    await (await load(undefined))();
    expect(getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("sends null device fields when unknown", async () => {
    device.manufacturer = null; device.modelName = null;
    await (await load("proj-1"))();
    expect(apiFetch).toHaveBeenCalledWith("/me/push-token", expect.objectContaining({
      body: expect.objectContaining({ manufacturer: null, model: null }),
    }));
  });

  it("swallows a token/registration failure", async () => {
    getExpoPushTokenAsync.mockRejectedValue(new Error("no FCM creds"));
    await expect((await load("proj-1"))()).resolves.toBeUndefined();
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
