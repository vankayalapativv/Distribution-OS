import { afterEach, describe, expect, it, vi } from "vitest";

const secure = {
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
};

async function loadWith(os: string) {
  vi.resetModules();
  vi.doMock("react-native", () => ({ Platform: { OS: os } }));
  vi.doMock("expo-secure-store", () => secure);
  return import("./auth-storage");
}

afterEach(() => {
  vi.doUnmock("react-native");
  vi.doUnmock("expo-secure-store");
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("auth-storage constants", () => {
  it("exposes the stable SecureStore key names", async () => {
    const m = await loadWith("ios");
    expect(m.TOKEN_KEY).toBe("distribution_os_auth_token");
    expect(m.USER_KEY).toBe("distribution_os_auth_user");
    expect(m.SESSION_KEY).toBe("distribution_os_neon_session");
    expect(m.LAST_USER_KEY).toBe("distribution_os_last_user_id");
  });
});

describe("storage (native)", () => {
  it("delegates to expo-secure-store", async () => {
    const m = await loadWith("android");
    expect(m.storage.get).toBe(secure.getItemAsync);
    expect(m.storage.set).toBe(secure.setItemAsync);
    expect(m.storage.del).toBe(secure.deleteItemAsync);
  });
});

describe("storage (web fallback)", () => {
  it("reads/writes/deletes through localStorage when present", async () => {
    const ls = { getItem: vi.fn(() => "v"), setItem: vi.fn(), removeItem: vi.fn() };
    (globalThis as { localStorage?: unknown }).localStorage = ls;
    const m = await loadWith("web");
    await expect(m.storage.get("k")).resolves.toBe("v");
    await m.storage.set("k", "x");
    await m.storage.del("k");
    expect(ls.setItem).toHaveBeenCalledWith("k", "x");
    expect(ls.removeItem).toHaveBeenCalledWith("k");
  });

  it("is inert (no throw, null reads) when localStorage is unavailable", async () => {
    const m = await loadWith("web");
    await expect(m.storage.get("k")).resolves.toBeNull();
    await expect(m.storage.set("k", "x")).resolves.toBeUndefined();
    await expect(m.storage.del("k")).resolves.toBeUndefined();
  });
});
