import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { maybePromptAutostart } from "./permissions-autostart";

const h = vi.hoisted(() => ({ platform: { OS: "android" }, device: { manufacturer: "", brand: "" } }));
const getItemAsync = vi.fn<(...a: unknown[]) => Promise<string | null>>(() => Promise.resolve(null));
const setItemAsync = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const openAutostartSettings = vi.fn<() => Promise<void>>(() => Promise.resolve());
const confirm = vi.fn<(...a: unknown[]) => Promise<boolean>>(() => Promise.resolve(true));

vi.mock("react-native", () => ({ get Platform() { return h.platform; } }));
vi.mock("expo-device", () => ({ get manufacturer() { return h.device.manufacturer; }, get brand() { return h.device.brand; } }));
vi.mock("expo-secure-store", () => ({ getItemAsync: (...a: unknown[]) => getItemAsync(...a), setItemAsync: (...a: unknown[]) => setItemAsync(...a) }));
vi.mock("./permissions-native", () => ({ openAutostartSettings: () => openAutostartSettings() }));

beforeEach(() => {
  h.platform.OS = "android"; h.device.manufacturer = "Xiaomi"; h.device.brand = "Redmi";
  getItemAsync.mockResolvedValue(null); confirm.mockResolvedValue(true);
});
afterEach(() => vi.clearAllMocks());

describe("maybePromptAutostart", () => {
  it("skips on non-Android", async () => {
    h.platform.OS = "ios";
    await maybePromptAutostart(confirm);
    expect(confirm).not.toHaveBeenCalled();
  });
  it("skips a non-aggressive OEM (incl. unknown null device fields)", async () => {
    h.device.manufacturer = "Google"; h.device.brand = "Pixel";
    await maybePromptAutostart(confirm);
    expect(confirm).not.toHaveBeenCalled();
    h.device.manufacturer = null as never; h.device.brand = null as never;
    await maybePromptAutostart(confirm);
    expect(confirm).not.toHaveBeenCalled();
  });
  it("skips when already prompted once", async () => {
    getItemAsync.mockResolvedValue("1");
    await maybePromptAutostart(confirm);
    expect(confirm).not.toHaveBeenCalled();
  });
  it("prompts an aggressive OEM, marks it, and opens settings on accept", async () => {
    await maybePromptAutostart(confirm);
    expect(confirm).toHaveBeenCalled();
    expect(setItemAsync).toHaveBeenCalledWith("distribution_os_autostart_prompted", "1");
    expect(openAutostartSettings).toHaveBeenCalled();
  });
  it("marks prompted but skips settings when declined", async () => {
    confirm.mockResolvedValue(false);
    await maybePromptAutostart(confirm);
    expect(setItemAsync).toHaveBeenCalled();
    expect(openAutostartSettings).not.toHaveBeenCalled();
  });
  it("tolerates a secure-store read failure", async () => {
    getItemAsync.mockRejectedValue(new Error("locked"));
    await maybePromptAutostart(confirm);
    expect(confirm).toHaveBeenCalled(); // read-fail → treated as not-yet-prompted
  });
  it("tolerates a secure-store write failure", async () => {
    setItemAsync.mockRejectedValue(new Error("locked"));
    await expect(maybePromptAutostart(confirm)).resolves.toBeUndefined();
    expect(openAutostartSettings).toHaveBeenCalled();
  });
});
