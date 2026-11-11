import { OTA_BUILD } from "../../lib/app-version";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SettingsSections } from "../../components/settings/settings-sections";
import { FailedItemsCard, SyncCard } from "../../components/settings/sync-status";
import { useSettingsScreen } from "../../lib/use-settings-screen";

/** S11 — profile, account, location, sync, logout. */
export default function SettingsScreen() {
  const { user, onLogout, roleLabel, sync, failedItems, retryFailed } = useSettingsScreen();

  return (
    <SafeAreaView className="flex-1 bg-secondary" edges={["top"]}>
      <View className="border-b border-border px-5 py-4">
        <Text className="text-xl font-bold text-foreground">Settings</Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="gap-5 px-5 py-4">
        {/* Profile */}
        <View className="rounded-3xl bg-accent p-5">
          <Text className="text-xl font-bold text-accent-foreground">{user?.name ?? "—"}</Text>
          <Text className="mt-1 text-sm text-accent-foreground/80">{user?.email ?? ""}</Text>
          <Text className="mt-0.5 text-xs font-medium text-accent-foreground/70">{roleLabel}</Text>
        </View>

        <SettingsSections />

        {/* Offline sync status + failed-upload inspector */}
        <SyncCard sync={sync} />
        {failedItems.length > 0 ? (
          <FailedItemsCard failedItems={failedItems} onRetry={retryFailed} />
        ) : null}

        {/* Logout */}
        <Pressable
          className="items-center rounded-full border border-destructive bg-card py-3.5"
          onPress={onLogout}
        >
          <Text className="font-semibold text-destructive">Log out</Text>
        </Pressable>

        <Text className="text-center text-xs text-muted-foreground">
          Distribution OS SE · v{OTA_BUILD}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
