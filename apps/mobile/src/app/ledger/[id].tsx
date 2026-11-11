/**
 * Customer ledger: a running Dr/Cr statement of invoices (Sale → debit) and
 * collections (Receipt → credit) for one customer — the same data as the web
 * ledger, with preset date filters. Shared by SALES_EXECUTIVE and SUPER_ADMIN
 * (read-only). ONLINE ONLY: the full all-time statement is fetched once and
 * sliced to the chosen range on-device (range switching is instant).
 */
import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ErrorState } from "../../components/error-state";
import { LedgerRowSkeleton, SkeletonList } from "../../components/skeleton";
import { LedgerBody } from "../../components/ledger/ledger-body";
import { LedgerHeader } from "../../components/ledger/ledger-header";
import { RangePresets } from "../../components/ledger/range-presets";
import { useAuth } from "../../lib/auth";
import { cacheKeys } from "../../lib/cache-keys";
import { fetchFullLedger } from "../../lib/ledger-fetch";
import { presetRange, type PresetKey } from "../../lib/ledger-presets";
import { sliceLedger } from "../../lib/ledger";
import { useCachedQuery } from "../../lib/use-cached-query";
import { usePullRefresh } from "../../lib/use-pull-refresh";

export default function CustomerLedgerScreen() {
  const { id, customerName } = useLocalSearchParams<{ id: string; customerName?: string }>();
  const token = useAuth((s) => s.token);
  const [preset, setPreset] = useState<PresetKey>("this-month");
  const { from, to } = presetRange(preset);

  const query = useCachedQuery({
    queryKey: ["ledger", id],
    cacheKey: cacheKeys.ledger(id ?? ""),
    fetcher: () => fetchFullLedger(id!, token),
    enabled: !!id,
  });
  const { refreshing, onRefresh } = usePullRefresh(() => query.refetch());
  const full = query.data;

  // Memoize the on-device slice — the full all-time statement can be hundreds of
  // rows, and re-slicing it on every render (range unchanged) was pure waste.
  const data = useMemo(
    () => (full ? sliceLedger(full, from, to) : undefined),
    [full, from, to],
  );

  return (
    <SafeAreaView className="flex-1 bg-secondary" edges={["top"]}>
      <LedgerHeader
        customerName={customerName ?? "Customer"}
        closingBalance={data?.totals.closingBalance ?? 0}
        pending={query.isPending}
      />
      <RangePresets preset={preset} onSelect={setPreset} />

      {(() => {
        if (query.isPending) {
          return (
            <View className="px-5 pt-3">
              <SkeletonList count={6} row={LedgerRowSkeleton} />
            </View>
          );
        }
        if (query.isError || !data) {
          return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
        }
        return <LedgerBody data={data} refreshing={refreshing} onRefresh={onRefresh} />;
      })()}
    </SafeAreaView>
  );
}
