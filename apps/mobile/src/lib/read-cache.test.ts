import { beforeEach, describe, expect, test, vi } from "vitest";
import { createTestDb } from "../test/node-sqlite-db";
import { migrateLocalDb, type LocalDb } from "./local-db";

// Back the read-cache with a real in-memory SQLite DB via the LocalDb interface.
let db: LocalDb | null = null;
vi.mock("./db", () => ({ getLocalDb: () => db }));

import { cachedFetch, cachedInitial, cachedUpdatedAt, readCache, writeCache } from "./read-cache";

beforeEach(() => {
  db = createTestDb();
  migrateLocalDb(db);
});

describe("read-cache", () => {
  test("writeCache / readCache round-trips a payload with a timestamp", () => {
    writeCache("k", { a: 1, b: "x" });
    const got = readCache<{ a: number; b: string }>("k");
    expect(got?.data).toEqual({ a: 1, b: "x" });
    expect(typeof got?.cachedAt).toBe("number");
  });

  test("cachedFetch caches on success and reports fromCache:false", async () => {
    const r = await cachedFetch("k", async () => ({ n: 5 }));
    expect(r).toEqual({ data: { n: 5 }, fromCache: false });
    expect(readCache<{ n: number }>("k")?.data).toEqual({ n: 5 });
  });

  test("cachedFetch falls back to the cached copy on failure (fromCache:true)", async () => {
    writeCache("k", { n: 9 });
    const r = await cachedFetch<{ n: number }>("k", async () => {
      throw new Error("offline");
    });
    expect(r).toEqual({ data: { n: 9 }, fromCache: true });
  });

  test("cachedFetch rethrows when the fetch fails AND there is no cache", async () => {
    await expect(
      cachedFetch("missing", async () => {
        throw new Error("offline");
      }),
    ).rejects.toThrow("offline");
  });

  test("cachedInitial / cachedUpdatedAt seed React Query from the cache", () => {
    expect(cachedInitial("k")).toBeUndefined();
    expect(cachedUpdatedAt("k")).toBeUndefined();
    writeCache("k", { v: 1 });
    expect(cachedInitial<{ v: number }>("k")).toEqual({ v: 1 });
    expect(typeof cachedUpdatedAt("k")).toBe("number");
  });

  test("no local DB (web) degrades to no-cache without throwing", async () => {
    db = null;
    writeCache("k", { a: 1 });
    expect(readCache("k")).toBeNull();
    const r = await cachedFetch("k", async () => ({ n: 1 }));
    expect(r).toEqual({ data: { n: 1 }, fromCache: false });
  });
});
