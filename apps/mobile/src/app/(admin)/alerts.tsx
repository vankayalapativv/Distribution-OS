import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "../../components/icon";
import { NotificationRowSkeleton, SkeletonList, SkeletonTheme } from "../../components/skeleton";
import { ActivityRow } from "../../components/alerts/activity-row";
import { useAdminAlerts } from "../../lib/use-admin-alerts";

/** Super Admin Alerts — activity feed of pushed events (login, order, collection,
 *  visit, new customer). Reads the shared /me/notifications feed (online-only). */
export default function AdminAlertsScreen() {
  const { items, loading, refreshing, onRefresh, onOpen, onDelete, onClearAll } = useAdminAlerts();

  return (
    <SafeAreaView className="flex-1 bg-secondary" edges={["top"]}>
      <View className="flex-row items-center justify-between border-b border-border px-5 py-4">
        <Text className="text-xl font-bold text-foreground">Alerts</Text>
        {items.length > 0 ? (
          <Pressable onPress={onClearAll} hitSlop={8}>
            <Text className="text-sm font-medium text-red-600">Clear all</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-2 px-4 py-3"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {(() => { if (loading && items.length === 0) return (
          <SkeletonTheme>
            <SkeletonList count={6} row={NotificationRowSkeleton} />
          </SkeletonTheme>
        ); if (items.length === 0) return (
          <View className="mt-16 items-center gap-2 px-8">
            <Icon name="notifications-outline" size={30} color="#9ca3af" />
            <Text className="text-center text-sm text-muted-foreground">
              No activity yet. New orders, collections, visits, customers and executive logins show up here.
            </Text>
          </View>
        ); return (
          items.map((n) => (
            <ActivityRow key={n.id} n={n} onPress={() => onOpen(n)} onDelete={() => onDelete(n.id)} />
          ))
        ); })()}
      </ScrollView>
    </SafeAreaView>
  );
}
