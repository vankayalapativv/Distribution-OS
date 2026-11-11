import { OTA_BUILD } from "../../lib/app-version";
import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Row, SectionLabel } from "../../components/logistics/settings-rows";
import { useLogisticsSettings } from "../../lib/use-logistics-settings";

/** Logistics settings — profile, account, logout. No sync/data UI. */
export default function LogisticsSettingsScreen() {
  const { user, hasActiveRun, onLogout } = useLogisticsSettings();

  const roleLabel = (user?.role ?? "")
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

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

        {/* Account */}
        <View className="gap-2">
          <SectionLabel>Account</SectionLabel>
          <View className="overflow-hidden rounded-3xl border border-border bg-card">
            <Pressable
              className="flex-row items-center justify-between px-4 py-3.5 active:bg-secondary"
              onPress={() => router.push("/settings/profile")}
            >
              <Text className="text-base text-card-foreground">Edit profile</Text>
              <Text className="text-lg text-muted-foreground">›</Text>
            </Pressable>
            <Row label="Change password" onPress={() => router.push("/settings/password")} />
          </View>
        </View>

        {/* Logout — blocked while a delivery run is active */}
        <Pressable
          className={`items-center rounded-full border py-3.5 ${
            hasActiveRun ? "border-border bg-card opacity-50" : "border-destructive bg-card"
          }`}
          onPress={onLogout}
        >
          <Text className={`font-semibold ${hasActiveRun ? "text-muted-foreground" : "text-destructive"}`}>
            Log out
          </Text>
        </Pressable>
        {hasActiveRun ? (
          <Text className="text-center text-xs text-muted-foreground">
            End your deliveries before logging out.
          </Text>
        ) : null}

        <Text className="text-center text-xs text-muted-foreground">
          Distribution OS Logistics · v{OTA_BUILD}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
