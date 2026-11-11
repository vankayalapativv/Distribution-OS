import { ApiError } from "../lib/errors";
import type { Role } from "../types";

/** The identity the auth middleware needs from the DB for one token. */
export interface Profile {
  userId: string | null;
  role: Role | null;
  enterpriseId: string | null;
}

// Auth does a DB lookup on EVERY authenticated request, so the DB is a hard
// dependency just for being logged in. To ride out a momentary Neon blip / cold
// start we (a) briefly cache the resolved profile per token so repeat requests
// skip the DB entirely, (b) retry the lookup once, and (c) fall back to a stale
// cache entry rather than logging the user out — only surfacing a 503 when there
// is no usable cache. Normal-operation staleness is bounded to PROFILE_TTL_MS
// (a role change / deactivation takes at most that long to take effect); during
// an actual outage a stale entry is served for at most MAX_STALE_MS before we
// give up and 503, so a revoked session can't be honoured indefinitely.
const PROFILE_TTL_MS = 10_000;
const MAX_STALE_MS = 60_000;
const RETRY_DELAY_MS = 50;
const CACHE_CAP = 1000;

interface Entry {
  value: Profile | null;
  expires: number;
}

// Best-effort, isolate-local cache. Correctness never depends on it persisting
// (a fresh isolate simply misses and hits the DB); it only reduces load and
// smooths over blips. Keyed by the full token so two identities never collide.
const cache = new Map<string, Entry>();

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Drop expired entries; if still over the cap, evict oldest-inserted first. */
function prune(now: number): void {
  for (const [key, entry] of cache) {
    if (entry.expires <= now) cache.delete(key);
  }
  if (cache.size > CACHE_CAP) {
    let toDrop = cache.size - CACHE_CAP;
    for (const key of cache.keys()) {
      cache.delete(key);
      if (--toDrop <= 0) break;
    }
  }
}

/**
 * Resolve a verified token's profile with DB-blip resilience.
 *
 * - A fresh cached value skips the DB entirely.
 * - `query` is retried once (short backoff) on failure.
 * - If it still fails, a stale cache entry is served instead of failing auth;
 *   with no cache at all, a 503 is thrown so the client retries rather than
 *   treating the outage as an invalid session.
 *
 * A successful "no such user" (`null`) is a normal, cacheable result — not an
 * error — and leaves the request unauthenticated as before.
 *
 * Only call this AFTER the token itself has verified: a verification failure is
 * not a DB problem and must remain an ordinary unauthenticated outcome.
 */
export async function resolveProfileResilient(
  token: string,
  query: () => Promise<Profile | null>,
): Promise<Profile | null> {
  const now = Date.now();
  const cached = cache.get(token);
  if (cached && cached.expires > now) return cached.value;

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const value = await query();
      cache.set(token, { value, expires: now + PROFILE_TTL_MS });
      prune(now);
      return value;
    } catch (error) {
      lastError = error;
      if (attempt === 0) await delay(RETRY_DELAY_MS);
    }
  }

  // The lookup failed twice. Prefer a still-recent stale profile over logging
  // the user out, but don't honour one older than MAX_STALE_MS.
  if (cached && now - (cached.expires - PROFILE_TTL_MS) <= MAX_STALE_MS) {
    return cached.value;
  }

  console.error("auth profile lookup failed (DB unavailable):", lastError);
  throw new ApiError(
    "SERVICE_UNAVAILABLE",
    "The service is temporarily unavailable. Please retry in a moment.",
    503,
  );
}

/** Test-only: clear the module cache between cases. */
export function __clearProfileCache(): void {
  cache.clear();
}
