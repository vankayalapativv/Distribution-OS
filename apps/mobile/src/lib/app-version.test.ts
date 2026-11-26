import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./update-release-info", () => ({ readUpdateReleaseInfo: vi.fn() }));

async function load(expoConfig: unknown) {
  vi.resetModules();
  vi.doMock("expo-constants", () => ({ default: { expoConfig } }));
  return import("./app-version");
}
afterEach(() => { vi.resetModules(); vi.clearAllMocks(); });

describe("app-version constants", () => {
  it("reads the native version and the OTA build label from app config", async () => {
    const m = await load({ version: "1.0.1", extra: { otaBuild: "1.0.1.4" } });
    expect(m.APP_VERSION).toBe("1.0.1");
    expect(m.OTA_BUILD).toBe("1.0.1.4");
  });
  it("falls back to defaults when the config is bare", async () => {
    const m = await load({});
    expect(m.APP_VERSION).toBe("0.0.1");
    expect(m.OTA_BUILD).toBe("0.0.1"); // defaults to APP_VERSION
  });
});
