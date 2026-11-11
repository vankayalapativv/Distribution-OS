/** The two queries behind the New Order screen: oils + credit load in parallel
 *  on open. Bearings are no longer offered on this screen (Sri Aparajita is
 *  oils-only; the catalogue is organised by brand tabs).
 *
 *  The oils catalogue reads through the SQLite read-cache (useCachedQuery): the
 *  on-sync prefetch (sync-core-prefetch) warms `cacheKeys.orderOils`, so the
 *  catalogue paints instantly on revisit and is available offline — but it must
 *  still REVALIDATE on open so newly-added products appear and the "showing last
 *  synced data" banner clears when we're actually online. We therefore leave
 *  staleTime at its default (0): useCachedQuery's `cachedFetch` is network-first
 *  (seed → refetch → fall back to the seed only if the refetch fails), so a fresh
 *  open fetches the latest catalogue while weak signal still degrades to cache.
 *  (A previous `staleTime: Infinity` defeated this: React Query treated the seed
 *  as fresh forever and never refetched, so the screen was stuck on stale data
 *  under a permanent offline banner until a re-login re-warmed the cache.)
 *
 *  Credit stays a plain online query — it already returns null on failure
 *  (unknown never blocks an order), so no cache is needed. */
import { useQuery } from "@tanstack/react-query";
import { cacheKeys } from "../cache-keys";
import { useCachedQuery } from "../use-cached-query";
import { fetchCredit, fetchOils } from "./api";
import type { Product } from "./types";

export function useOrderQueries(customerId: string | undefined, token: string | null) {
  const oils = useCachedQuery<Product[]>({
    queryKey: ["order-oils"],
    cacheKey: cacheKeys.orderOils,
    fetcher: () => fetchOils(token),
    enabled: Boolean(token),
  });
  const credit = useQuery({
    queryKey: ["order-credit", customerId],
    queryFn: () => fetchCredit(customerId!, token),
    enabled: Boolean(customerId && token),
  });
  return { oils, credit };
}
