import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SkeletonTheme } from "../../components/skeleton";
import { AdminDuesCard } from "../../components/admin-dues-card";
import { AdminSeDuesCard } from "../../components/admin-se-dues-card";
import { AdminFulfillmentCard } from "../../components/admin-fulfillment-card";
import { LeaderboardCard } from "../../components/leaderboard-card";
import { SegmentSalesCard } from "../../components/segment-sales-card";
import { AdminKpiGrid } from "../../components/home/admin-kpi-grid";
import { ErrorState } from "../../components/error-state";
import { Icon } from "../../components/icon";
import { DateRangeSheet, rangeLabel } from "../../components/date-range-sheet";
import { useAdminDashboard } from "../../lib/use-admin-dashboard";
import { useCallback, useState } from "react";

/** Super Admin Home — live KPI cards mirroring the web dashboard (today, IST). */
export default function AdminHomeScreen() {
  const { metrics, error, refreshing, range, isToday, load, onRefresh, applyRange } =
    useAdminDashboard();
  const [sheetOpen, setSheetOpen] = useState(false);
  // Bumped on pull-to-refresh; every self-fetching card watches it, blanks to its
  // skeleton and refetches — so a pull reloads the WHOLE home with the same
  // "fetching" shimmer as first open (not just the KPI grid).
  const [refreshSignal, setRefreshSignal] = useState(0);
  const handleRefresh = useCallback(() => {
    setRefreshSignal((n) => n + 1);
    void onRefresh();
  }, [onRefresh]);

  return (
    <SafeAreaView className="flex-1 bg-secondary" edges={["top"]}>
      <View className="flex-row items-center justify-between border-b border-border px-5 py-4">
        <Text className="text-xl font-bold text-foreground">Dashboard</Text>
        <Pressable
          onPress={() => setSheetOpen(true)}
          className="flex-row items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5"
        >
          <Icon name="calendar-outline" size={14} color="#6b7280" />
          <Text className="text-xs font-medium text-foreground">
            {isToday ? "Today" : rangeLabel(range.from, range.to)}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-3 px-5 py-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {error && !metrics ? (
          // The whole dashboard failed for ONE reason (payment / offline / server).
          // Show a single clear, humanized banner and skip the cards below — they
          // would all fail the same way, so repeating "couldn't load" per card is
          // just noise. One message, one Retry.
          <ErrorState error={error} onRetry={() => void load()} />
        ) : (
          <>
            {metrics ? (
              <AdminKpiGrid metrics={metrics} range={range} />
            ) : (
              // Loading: same cards, but the shared sweep drives the value shimmers.
              <SkeletonTheme>
                <AdminKpiGrid metrics={null} range={range} />
              </SkeletonTheme>
            )}

            {/* Master collection-dues → full SE-filterable buckets screen.
                Each card owns its own fetch + skeleton, loading in parallel. */}
            <AdminDuesCard refreshSignal={refreshSignal} />

            {/* Total collection dues per SE — ranked, so the SA sees who's carrying
                the most outstanding at a glance. Display-only; self-fetching. */}
            <AdminSeDuesCard refreshSignal={refreshSignal} />

            {/* SE oil-litres leaderboard — the same peer-ranking card the SEs see on
                their Home (Today/Week/Month toggle, medals). No 'You' row for the SA. */}
            <LeaderboardCard refreshSignal={refreshSignal} />

            {/* Per-SE oil litres split by the 6 segments (Today/Week/Month); each row
                expands to the full breakdown. Complements the total-litres leaderboard. */}
            <SegmentSalesCard refreshSignal={refreshSignal} />

            {/* Order-fulfillment funnel — all-time snapshot, also self-fetching so it
                loads in parallel (independent of the range-scoped KPIs above). */}
            <AdminFulfillmentCard refreshSignal={refreshSignal} />
          </>
        )}
      </ScrollView>

      <DateRangeSheet
        visible={sheetOpen}
        from={range.from}
        to={range.to}
        onApply={(from, to) => {
          applyRange(from, to);
          setSheetOpen(false);
        }}
        onClose={() => setSheetOpen(false)}
      />
    </SafeAreaView>
  );
}
