import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { GROUPS, Tile } from "./home/admin-fulfillment-parts";
import { chunkPairs, FulfillmentCardSkeleton } from "./home/admin-fulfillment-card-parts";
import { fetchFulfillmentSummary, type FulfillmentSummary } from "../lib/admin-fulfillment";

/** Order-fulfillment funnel card on the SA Home — all-time snapshot, grouped
 *  (In progress → Completed → Returns), stage-tinted, zero-count stages hidden.
 *  Self-fetches (owns its skeleton) so it loads in parallel with the KPIs. */
export function AdminFulfillmentCard({ refreshSignal = 0 }: { readonly refreshSignal?: number } = {}) {
  const [summary, setSummary] = useState<FulfillmentSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Focus refetch — silent (keep the current tiles while it reloads).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void fetchFulfillmentSummary()
        .then((data) => {
          if (!cancelled) setSummary(data);
        })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // Pull-to-refresh — blank to the skeleton first, then reload (fetching shimmer).
  useEffect(() => {
    if (refreshSignal === 0) return;
    setSummary(null);
    setLoading(true);
    let cancelled = false;
    void fetchFulfillmentSummary()
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshSignal]);

  if (!summary) {
    return loading ? <FulfillmentCardSkeleton /> : null;
  }

  // Hide zero-count stages, then drop any group left empty. Cancelled is always
  // shown (even at 0) so the terminal "Cancelled" count is never silently omitted.
  const groups = GROUPS.map((g) => ({
    title: g.title,
    stages: g.stages.filter((s) => s.key === "cancelled" || (summary[s.key] ?? 0) > 0),
  })).filter((g) => g.stages.length > 0);

  // Nothing to show (no orders at all) → render nothing rather than an empty card.
  if (groups.length === 0) return null;

  return (
    <View className="rounded-3xl border border-border bg-card p-4">
      <Text className="mb-3 text-sm font-semibold text-card-foreground">Order fulfillment</Text>
      {groups.map((g, i) => (
        <View key={g.title} className={i > 0 ? "mt-4 border-t border-border pt-4" : ""}>
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {g.title}
          </Text>
          <View className="mt-2 gap-2">
            {chunkPairs(g.stages).map((pair) => (
              <View key={pair[0].key} className="flex-row gap-2">
                {pair.map((s) => (
                  <Tile key={s.key} stage={s} value={summary[s.key] ?? 0} />
                ))}
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
