import { afterEach, describe, expect, it, vi } from "vitest";
import { __clearProfileCache, resolveProfileResilient } from "./auth-profile";

const PROFILE = { userId: "u1", role: "MANAGER" as const };

afterEach(() => {
  __clearProfileCache();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("resolveProfileResilient — #4 auth DB-blip resilience", () => {
  it("returns the profile and caches it (a 2nd call skips the DB)", async () => {
    const q = vi.fn().mockResolvedValue(PROFILE);
    expect(await resolveProfileResilient("tokA", q)).toEqual(PROFILE);
    expect(await resolveProfileResilient("tokA", q)).toEqual(PROFILE);
    expect(q).toHaveBeenCalledTimes(1);
  });

  it("retries once on a DB error, then succeeds", async () => {
    const q = vi
      .fn()
      .mockRejectedValueOnce(new Error("neon blip"))
      .mockResolvedValueOnce(PROFILE);
    expect(await resolveProfileResilient("tokB", q)).toEqual(PROFILE);
    expect(q).toHaveBeenCalledTimes(2);
  });

  it("throws a 503 ApiError when the DB fails twice with no cache", async () => {
    const q = vi.fn().mockRejectedValue(new Error("neon down"));
    await expect(resolveProfileResilient("tokC", q)).rejects.toMatchObject({
      name: "ApiError",
      status: 503,
      code: "SERVICE_UNAVAILABLE",
    });
    expect(q).toHaveBeenCalledTimes(2);
  });

  it("serves a STALE cached profile instead of 503 when the DB later fails", async () => {
    vi.useFakeTimers();
    const q = vi
      .fn()
      .mockResolvedValueOnce(PROFILE)
      .mockRejectedValue(new Error("neon down"));
    expect(await resolveProfileResilient("tokD", q)).toEqual(PROFILE); // caches
    await vi.advanceTimersByTimeAsync(11_000); // entry is now stale
    const pending = resolveProfileResilient("tokD", q);
    await vi.advanceTimersByTimeAsync(100); // let the retry backoff elapse
    expect(await pending).toEqual(PROFILE); // stale cache rides the outage
    expect(q).toHaveBeenCalledTimes(3); // 1 success + 2 failed retries
  });

  it("stops honouring a stale profile after the max-stale window (503)", async () => {
    vi.useFakeTimers();
    const q = vi
      .fn()
      .mockResolvedValueOnce(PROFILE)
      .mockRejectedValue(new Error("neon down"));
    expect(await resolveProfileResilient("tokF", q)).toEqual(PROFILE); // caches
    await vi.advanceTimersByTimeAsync(61_000); // older than MAX_STALE_MS (60s)
    const pending = resolveProfileResilient("tokF", q);
    const assertion = expect(pending).rejects.toMatchObject({ status: 503 });
    await vi.advanceTimersByTimeAsync(100); // let the retry backoff elapse
    await assertion;
  });

  it("caches a 'no such user' (null) as a normal, non-error result", async () => {
    const q = vi.fn().mockResolvedValue(null);
    expect(await resolveProfileResilient("tokE", q)).toBeNull();
    expect(await resolveProfileResilient("tokE", q)).toBeNull();
    expect(q).toHaveBeenCalledTimes(1);
  });

  it("evicts oldest-inserted entries once the cache exceeds its cap", async () => {
    const q = vi.fn().mockResolvedValue(PROFILE);
    // Fill past CACHE_CAP (1000) with distinct, still-fresh tokens so the
    // expiry sweep can't remove them — forcing the size-cap eviction path.
    for (let i = 0; i <= 1000; i++) {
      await resolveProfileResilient(`cap-${i}`, q);
    }
    expect(q).toHaveBeenCalledTimes(1001);

    // The oldest token (cap-0) was evicted, so it now misses and re-queries;
    // a recent one (cap-1000) is still cached and does not.
    q.mockClear();
    await resolveProfileResilient("cap-0", q);
    await resolveProfileResilient("cap-1000", q);
    expect(q).toHaveBeenCalledTimes(1);
  });
});
