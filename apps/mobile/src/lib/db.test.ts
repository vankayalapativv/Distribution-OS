import { afterEach, describe, expect, it, vi } from "vitest";
import { getLocalDb } from "./db";

const execSync = vi.fn();
const runSync = vi.fn();
const getAllSync = vi.fn(() => [] as unknown[]);
const getFirstSync = vi.fn<(...a: unknown[]) => unknown>(() => undefined);
const openNativeDb = vi.fn(() => ({ execSync, runSync, getAllSync, getFirstSync }));

let platformOS = "web";
vi.mock("react-native", () => ({ Platform: { get OS() { return platformOS; } } }));
vi.mock("./native-sqlite", () => ({ openNativeDb: () => openNativeDb() }));

afterEach(() => {
  vi.clearAllMocks();
  getFirstSync.mockReturnValue(undefined);
});

describe("getLocalDb", () => {
  it("returns null on web (no native sqlite)", () => {
    platformOS = "web";
    expect(getLocalDb()).toBeNull();
    expect(openNativeDb).not.toHaveBeenCalled();
  });

  it("opens, migrates and caches the native db, delegating each op", () => {
    platformOS = "android";
    const db = getLocalDb()!;
    expect(db).not.toBeNull();

    db.exec("PRAGMA foo");
    expect(execSync).toHaveBeenCalledWith("PRAGMA foo");
    db.run("insert ?", [1]);
    expect(runSync).toHaveBeenCalledWith("insert ?", [1]);
    db.run("insert none"); // default params → []
    expect(runSync).toHaveBeenCalledWith("insert none", []);
    expect(db.all("select 1")).toEqual([]);

    expect(db.first("select 1")).toBeNull(); // driver returned nothing → null
    getFirstSync.mockReturnValue({ id: 1 });
    expect(db.first("select 1")).toEqual({ id: 1 });

    getLocalDb(); // reuses the cached instance (no re-open)
    expect(openNativeDb).toHaveBeenCalledOnce();
  });
});
