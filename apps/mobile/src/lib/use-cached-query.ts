/**
 * React Query + read-through SQLite cache, as one drop-in hook.
 *
 * Behaves like `useQuery` but:
 *  - seeds `initialData` from the SQLite cache so the screen paints the last-synced
 *    data instantly (no spinner on a revisit), then revalidates in the background;
 *  - the query function is network-first via `cachedFetch`, so an offline/failed
 *    refetch falls back to the cached copy instead of erroring;
 *  - returns `data` already UNWRAPPED (T | undefined) plus a `fromCache` flag so a
 *    screen can show a subtle "showing last synced data" banner.
 *
 * It only throws (query goes to `isError`) when the fetch fails AND there is no
 * cache — exactly the case the offline-aware ErrorState should handle.
 */
import { type QueryKey, type UseQueryResult, useQuery } from "@tanstack/react-query";
import { cachedFetch, type CachedResult, readCache } from "./read-cache";

/**
 * Return type is a drop-in for `UseQueryResult<T>` (consumers read
 * `data`/`isPending`/`isError`/`refetch` as usual) plus a `fromCache` flag. The
 * cast is sound: we only ever expose the UNWRAPPED `data` (T | undefined), exactly
 * what a useQuery consumer reads.
 */
export function useCachedQuery<T>(opts: {
  queryKey: QueryKey;
  cacheKey: string;
  fetcher: () => Promise<T>;
  enabled?: boolean;
  staleTime?: number;
  refetchInterval?: number;
}): UseQueryResult<T> & { fromCache: boolean } {
  const seed = readCache<T>(opts.cacheKey);
  const query = useQuery<CachedResult<T>>({
    queryKey: opts.queryKey,
    queryFn: () => cachedFetch(opts.cacheKey, opts.fetcher),
    enabled: opts.enabled,
    staleTime: opts.staleTime,
    refetchInterval: opts.refetchInterval,
    // Seed from cache; the OLD updatedAt makes RQ refetch on mount (revalidate)
    // rather than trusting the seed as fresh.
    initialData: seed ? { data: seed.data, fromCache: true } : undefined,
    initialDataUpdatedAt: seed?.cachedAt,
  });
  return {
    ...query,
    data: query.data?.data,
    fromCache: query.data?.fromCache ?? false,
  } as unknown as UseQueryResult<T> & { fromCache: boolean };
}
