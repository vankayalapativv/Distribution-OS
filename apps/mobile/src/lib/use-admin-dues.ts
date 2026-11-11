import { useCallback, useEffect, useState } from "react";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import type { DuesBucketKey, DuesSummary } from "./dues";
import {
  fetchAdminDuesCustomers,
  fetchAdminDuesSummary,
  fetchSalesExecutives,
  type AdminDuesCustomer,
  type SalesExec,
} from "./admin-dues";

export const BUCKETS: DuesBucketKey[] = ["0_30", "30_45", "45_60", "60_plus"];

/** State + data-loading for the master collection-dues screen: the SE list, the
 *  ageing summary, and the customers in the selected bucket (per SE filter). */
export function useAdminDues() {
  // The Home dues card deep-links a specific bucket via `?bucket=` — open that
  // tab (falling back to 0–30 when absent/invalid, e.g. a plain card tap).
  const { bucket: bucketParam } = useLocalSearchParams<{ bucket?: string }>();
  const paramBucket = BUCKETS.includes(bucketParam as DuesBucketKey)
    ? (bucketParam as DuesBucketKey)
    : null;
  const [execs, setExecs] = useState<SalesExec[]>([]);
  const [execsLoading, setExecsLoading] = useState(true);
  const [execId, setExecId] = useState<string | null>(null); // null = All
  const [bucket, setBucket] = useState<DuesBucketKey>(paramBucket ?? "0_30");

  // Re-select the tab if the incoming bucket changes (new navigation with a
  // different `?bucket=`), without clobbering a manual tab tap.
  useEffect(() => {
    if (paramBucket) setBucket(paramBucket);
  }, [paramBucket]);
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

  const loadCustomers = useCallback(async () => {
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

  const bucketCount = (k: DuesBucketKey) =>
    summary?.buckets.find((b) => b.key === k)?.customers ?? 0;
  const bucketOutstanding = (k: DuesBucketKey) =>
    summary?.buckets.find((b) => b.key === k)?.outstanding ?? 0;

  return {
    execs, execsLoading, execId, setExecId, bucket, setBucket, customers,
    loading, listLoading, error, refreshing, onRefresh, loadSummary,
    bucketCount, bucketOutstanding,
  };
}
