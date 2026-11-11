import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { fetchDuesByExecutive, type SeDues } from "../lib/admin-dues";
import { SeDuesRows, SeDuesSkeleton } from "./admin-se-dues-parts";

/** SA Home "Dues by executive" — each SE carrying collection dues, with their
 *  total outstanding + how many of their customers owe, ranked highest first
 *  (SEs with no dues are omitted). Includes opening balances, so it reconciles
 *  with the master Collection-dues card above it. Display-only (no drill-down).
 *  Self-fetching with the shared refreshSignal: focus refetch is silent,
 *  pull-to-refresh blanks to the skeleton first. */
export function AdminSeDuesCard({ refreshSignal = 0 }: { readonly refreshSignal?: number } = {}) {
  const [rows, setRows] = useState<SeDues[] | null>(null);
  const [failed, setFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void fetchDuesByExecutive()
        .then((data) => !cancelled && setRows(data))
        .catch(() => !cancelled && setFailed(true));
      return () => {
        cancelled = true;
      };
    }, []),
  );

  useEffect(() => {
    if (refreshSignal === 0) return;
    setRows(null);
    setFailed(false);
    let cancelled = false;
    void fetchDuesByExecutive()
      .then((data) => !cancelled && setRows(data))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [refreshSignal]);

  // Fetch failed with nothing to show → hide (don't shimmer forever).
  if (!rows && failed) return null;

  return (
    <View className="rounded-3xl border border-border bg-card p-4">
      <View className="mb-1 flex-row items-baseline justify-between">
        <Text className="text-sm font-semibold text-card-foreground">Dues by executive</Text>
        <Text className="text-[11px] text-muted-foreground">outstanding · high to low</Text>
      </View>
      {rows ? (
        (() => { if (rows.length === 0) return (
          <Text className="py-4 text-center text-sm text-muted-foreground">No outstanding dues.</Text>
        ); return (
          <SeDuesRows rows={rows} />
        ); })()
      ) : (
        <SeDuesSkeleton />
      )}
    </View>
  );
}
