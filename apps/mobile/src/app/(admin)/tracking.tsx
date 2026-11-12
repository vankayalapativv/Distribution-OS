import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TrackingDateStepper } from "../../components/admin/tracking-date-stepper";
import { TrackingMap } from "../../components/admin/tracking-map";
import { TrackingRepStrip } from "../../components/admin/tracking-rep-strip";
import { useAdminTracking } from "../../lib/use-admin-tracking";

/** Live SE + Logistics tracking map for the Super Admin: title + date in the
 *  header, a horizontal strip of reps above the map, and the map filling the rest. */
export default function AdminTrackingScreen() {
  const t = useAdminTracking();

  return (
    <SafeAreaView className="flex-1 bg-secondary" edges={["top"]}>
      <View className="flex-row items-center justify-between border-b border-border bg-card px-5 py-3">
        <Text className="text-xl font-bold text-foreground">Tracking</Text>
        <TrackingDateStepper date={t.date} setDate={t.setDate} />
      </View>

      <TrackingRepStrip
        loading={t.loading}
        execs={t.execs}
        selectedId={t.selectedId}
        setSelectedId={t.setSelectedId}
      />

      <View className="flex-1">
        <TrackingMap
          visible={t.visible}
          route={t.route}
          routeStale={t.routeStale}
          selectedId={t.selectedId}
          setSelectedId={t.setSelectedId}
          customers={t.customers}
          bands={t.bands}
          checkins={t.checkins}
        />
      </View>
    </SafeAreaView>
  );
}
