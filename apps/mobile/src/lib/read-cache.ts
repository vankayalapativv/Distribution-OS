/**
 * Generic read-through cache over the local SQLite `read_cache` table.
 *
 * The app is online-first, but a field SE is often in a dead zone. These helpers
 * let a read screen paint instantly from the last-synced copy, then revalidate:
 *  - `cachedFetch(key, fetcher)` — network-first: run the fetcher, cache + return
 *    on success; on failure fall back to the cached copy (fromCache:true); throw
 *    only when there is no cache to show.
 *  - `readCache` / `writeCache` — raw get/set.
 *  - `cachedInitial` / `cachedUpdatedAt` — seed React Query `initialData` /
 *    `initialDataUpdatedAt` so the screen shows last-synced data immediately and
 *    refetches in the background.
 *
 * The on-sync prefetch (sync-core-prefetch) writes the SAME keys these screens
 * read (see cache-keys.ts), so records work offline even if never opened. All
 * access is best-effort: no local DB (web) or any SQLite error degrades to "no
 * cache", never throws from the cache layer itself.
 */
import { getLocalDb } from "./db";

interface CacheRow {
  payload_json: string;
  cached_at: number;
}

/** Persist the latest payload for a cache key. Best-effort (no-op on web/error). */
export function writeCache(key: string, data: unknown): void {
  const db = getLocalDb();
  if (!db) return;
  try {
    db.run(
      `insert into read_cache (key, payload_json, cached_at) values (?, ?, ?)
       on conflict(key) do update set payload_json = excluded.payload_json, cached_at = excluded.cached_at`,
      [key, JSON.stringify(data), Date.now()],
    );
  } catch {
    // Cache is advisory — never let a write failure surface.
  }
}

/** The cached payload + when it was written, or null when absent/unreadable. */
export function readCache<T>(key: string): { data: T; cachedAt: number } | null {
  const db = getLocalDb();
  if (!db) return null;
  try {
    const row = db.first<CacheRow>("select payload_json, cached_at from read_cache where key = ?", [key]);
    if (!row) return null;
    return { data: JSON.parse(row.payload_json) as T, cachedAt: row.cached_at };
  } catch {
    return null;
  }
}

/** React Query `initialData` seed — the cached payload, or undefined. */
export function cachedInitial<T>(key: string): T | undefined {
  return readCache<T>(key)?.data;
}

/** React Query `initialDataUpdatedAt` seed — when the cache was written. Passing
 *  this (an old timestamp) makes the query refetch on mount instead of trusting
 *  the seeded data as fresh. */
export function cachedUpdatedAt(key: string): number | undefined {
  return readCache<unknown>(key)?.cachedAt;
}

export interface CachedResult<T> {
  data: T;
  /** true when the network fetch failed and this is the last-synced copy. */
  fromCache: boolean;
}

/**
 * Network-first read-through: run `fetcher`; on success cache + return it
 * (fromCache:false). On failure return the cached copy (fromCache:true) if any,
 * else rethrow (nothing to show → the screen's error state handles it).
 */
export async function cachedFetch<T>(key: string, fetcher: () => Promise<T>): Promise<CachedResult<T>> {
  try {
    const data = await fetcher();
    writeCache(key, data);
    return { data, fromCache: false };
  } catch (err) {
    const cached = readCache<T>(key);
    if (cached) return { data: cached.data, fromCache: true };
    throw err;
  }
}
