import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SkeletonTheme } from "./skeleton";
import { AdminDuesBody } from "./home/admin-dues-body";
import { fetchAdminDuesSummary } from "../lib/admin-dues";
import type { DuesBucketKey, DuesSummary } from "../lib/dues";

/** Master collection-dues card on the SA Home — total + 4-bucket strip; taps
 *  through to the full, SE-filterable dues screen. The card chrome (title,
 *  "Tap to view all", "outstanding", the bucket day-labels) renders immediately;
 *  only the server numbers (total, customer count, per-bucket count + ₹) shimmer. */
export function AdminDuesCard({ refreshSignal = 0 }: { readonly refreshSignal?: number } = {}) {
  const [summary, setSummary] = useState<DuesSummary | null>(null);
  const [failed, setFailed] = useState(false);

  // Focus refetch — silent (keep the current numbers while it reloads).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void fetchAdminDuesSummary()
        .then((data) => {
          if (!cancelled) setSummary(data);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
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
    setFailed(false);
    let cancelled = false;
    void fetchAdminDuesSummary()
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshSignal]);

  // Fetch failed with nothing to show → hide the card (don't shimmer forever).
  if (!summary && failed) return null;

  // Tapping a single bucket cell deep-links to that bucket's tab; tapping the
  // rest of the card opens the dues screen on its default (0–30) tab.
  const openBucket = (bucket: DuesBucketKey) =>
    router.push({ pathname: "/(admin)/dues", params: { bucket } });

  return (
    <Pressable
      onPress={() => router.push("/(admin)/dues")}
      className="rounded-3xl border border-border bg-card p-4"
    >
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-card-foreground">Collection dues</Text>
        <Text className="text-xs text-muted-foreground">Tap to view all ›</Text>
      </View>
      {summary ? (
        <AdminDuesBody summary={summary} onBucket={openBucket} />
      ) : (
        <SkeletonTheme>
          <AdminDuesBody summary={null} onBucket={openBucket} />
        </SkeletonTheme>
      )}
    </Pressable>
  );
}
