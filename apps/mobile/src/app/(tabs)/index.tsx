import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDialog } from "../../components/dialog";
import { BeatCard } from "../../components/home/beat-card";
import { DayEndedCard } from "../../components/home/day-ended-card";
import { EndDayButton } from "../../components/home/end-day-button";
import { GreetingHeader } from "../../components/home/greeting-header";
import { StartDayButton } from "../../components/home/start-day-button";
import { PerformanceCard } from "../../components/performance-card";
import { LeaderboardCard } from "../../components/leaderboard-card";
import { DuesCard } from "../../components/dues-card";
import { useAuth } from "../../lib/auth";
import { useDayTracking } from "../../lib/use-day-tracking";
import { usePullRefresh } from "../../lib/use-pull-refresh";

/** S3 — Home: field dashboard (Start day, performance, leaderboard, dues). */
export default function HomeScreen() {
  const user = useAuth((s) => s.user);
  const dialog = useDialog();
  const { dayOn, dayEnded, dayBusy, onStartDay, onEndDay } = useDayTracking({
    confirm: dialog.confirm,
    prompt: dialog.prompt,
  });
  // Bumping this re-triggers each card's refresh fetch (pull-to-refresh).
  const [refreshKey, setRefreshKey] = useState(0);

  // Keep the pull spinner up until the cards' refresh fetches actually finish.
  // The four self-fetching cards each call onCardSettled when their refresh
  // settles; onRefresh resolves once all four report (or an 8s safety timeout).
  const HOME_CARD_COUNT = 4;
  const reportRef = useRef<(() => void) | null>(null);
  const onCardSettled = useCallback(() => reportRef.current?.(), []);

  // Refetch the whole dashboard when the app returns to the foreground. Screen
  // useFocusEffect (in each card) covers in-app navigation, but NOT an
  // Android/iOS background→foreground resume while Home is already the active
  // tab — so a just-placed order / updated target would otherwise show stale
  // until a manual pull-to-refresh. Bumping refreshKey re-fetches all cards.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setRefreshKey((k) => k + 1);
    });
    return () => sub.remove();
  }, []);

  const { refreshing, onRefresh } = usePullRefresh(
    useCallback(
      () =>
        new Promise<void>((resolve) => {
          let remaining = HOME_CARD_COUNT;
          let timer: ReturnType<typeof setTimeout>;
          const finish = () => {
            clearTimeout(timer);
            reportRef.current = null;
            resolve();
          };
          timer = setTimeout(finish, 8000); // never spin forever on a hung fetch
          reportRef.current = () => {
            remaining -= 1;
            if (remaining <= 0) finish();
          };
          setRefreshKey((k) => k + 1);
        }),
      [],
    ),
  );

  // Light grey ground (bg-secondary, theme-aware) so the white cards + button
  // lift off it — matches the approved mockup.
  return (
    <SafeAreaView className="flex-1 bg-secondary" edges={["top"]}>
      <View className="flex-row items-center justify-between border-b border-border px-5 py-4">
        <GreetingHeader name={user?.name ?? ""} />
        {dayOn ? <EndDayButton busy={dayBusy} onPress={() => void onEndDay()} /> : null}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-5 py-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {!dayOn && dayEnded ? <DayEndedCard /> : null}
        {!dayOn && !dayEnded ? <StartDayButton busy={dayBusy} onPress={onStartDay} /> : null}

        {/* Today's beat plan + progress — shown regardless of Start Day so the SE
            can preview the route; check-in itself still requires the day to be on. */}
        <BeatCard refreshSignal={refreshKey} onSettled={onCardSettled} />

        {/* Actual vs target (set by Super Admin / Manager) */}
        <PerformanceCard refreshSignal={refreshKey} onSettled={onCardSettled} />

        {/* Peer leaderboard — how this SE ranks on oil litres vs everyone. */}
        <LeaderboardCard refreshSignal={refreshKey} onSettled={onCardSettled} />

        {/* Customers per dues ageing bucket, tappable */}
        <DuesCard refreshSignal={refreshKey} onSettled={onCardSettled} />
      </ScrollView>
    </SafeAreaView>
  );
}
