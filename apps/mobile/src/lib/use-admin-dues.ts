import { useCallback, useEffect, useState } from "react";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import type { DuesBucketKey, DuesBucketSummary, DuesSummary } from "./dues";
import {
  fetchAdminDuesCustomers,
  fetchAdminDuesSummary,
  fetchSalesExecutives,
  type AdminDuesCustomer,
  type SalesExec,
} from "./admin-dues";

/** State + data-loading for the master collection-dues screen: the SE list, the
 *  ageing summary, and the customers in the selected bucket (per SE filter).
 *
 *  Bands are SERVER-DRIVEN — each enterprise defines its own ageing bands in
 *  onboarding and the API returns them keyed by ordinal ("0".."N-1"). This hook
 *  must therefore read the band list from the summary; it must NOT assume the
 *  legacy fixed keys ("0_30"…), which no longer exist (doing so made every bucket
 *  read 0 and the customer list 422 → "No customers in this bucket"). */
export function useAdminDues() {
  // The Home dues card deep-links a specific band via `?bucket=` (a real ordinal
  // key). Seed from it; reconcile to a valid band once the summary loads.
  const { bucket: bucketParam } = useLocalSearchParams<{ bucket?: string }>();
  const [execs, setExecs] = useState<SalesExec[]>([]);
  const [execsLoading, setExecsLoading] = useState(true);
  const [execId, setExecId] = useState<string | null>(null); // null = All
  const [bucket, setBucket] = useState<DuesBucketKey>(bucketParam ?? "");

  // Re-select the tab if the incoming bucket changes (new navigation with a
  // different `?bucket=`), without clobbering a manual tab tap.
  useEffect(() => {
    if (bucketParam) setBucket(bucketParam);
  }, [bucketParam]);
  const [summary, setSummary] = useState<DuesSummary | null>(null);
  const [customers, setCustomers] = useState<AdminDuesCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(true);
  // Raw thrown value so the UI can humanize it (severity + friendly title).
  const [error, setError] = useState<unknown>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadSummary = useCallback(async () => {
    setError(null);
    try {
      setSummary(await fetchAdminDuesSummary(execId));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [execId]);

  const buckets: DuesBucketSummary[] = summary?.buckets ?? [];

  // Once the enterprise's bands are known, make sure a REAL band is selected.
  // The seeded param (or "") may match none — e.g. a plain card tap, or a stale
  // legacy key — so fall back to the first band.
  useEffect(() => {
    if (buckets.length === 0) return;
    if (!buckets.some((b) => b.key === bucket)) setBucket(buckets[0].key);
  }, [buckets, bucket]);

  const loadCustomers = useCallback(async () => {
    if (!bucket) return; // no band selected yet (summary not loaded)
    setListLoading(true);
    try {
      const res = await fetchAdminDuesCustomers(bucket, execId);
      setCustomers(res.customers);
    } catch {
      setCustomers([]);
    } finally {
      setListLoading(false);
    }
  }, [bucket, execId]);

  useFocusEffect(
    useCallback(() => {
      void fetchSalesExecutives()
        .then(setExecs)
        .catch(() => undefined)
        .finally(() => setExecsLoading(false));
      void loadSummary();
    }, [loadSummary]),
  );

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadSummary(), loadCustomers()]);
    setRefreshing(false);
  }, [loadSummary, loadCustomers]);

  return {
    execs, execsLoading, execId, setExecId, bucket, setBucket, buckets, customers,
    loading, listLoading, error, refreshing, onRefresh, loadSummary,
  };
}
