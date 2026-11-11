import { OTA_BUILD } from "../../lib/app-version";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Row, SectionLabel } from "../../components/admin/settings-rows";
import { useAdminSettings } from "../../lib/use-admin-settings";

/**
 * Super Admin settings — online-only, so it drops the offline/sync surface
 * (Data & storage, Sync card, Failed-items inspector) that the SE screen shows.
 * Keeps profile, account, help & about, and logout.
 */
export default function AdminSettingsScreen() {
  const { user, roleLabel, onLogout } = useAdminSettings();

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

        {/* App */}
        <View className="gap-2">
          <SectionLabel>App</SectionLabel>
          <View className="overflow-hidden rounded-3xl border border-border bg-card">
            <Pressable
              className="flex-row items-center justify-between px-4 py-3.5 active:bg-secondary"
              onPress={() => router.push("/settings/about")}
            >
              <Text className="text-base text-card-foreground">Help</Text>
              <Text className="text-lg text-muted-foreground">›</Text>
            </Pressable>
          </View>
        </View>

        {/* Logout */}
        <Pressable
          className="items-center rounded-full border border-destructive bg-card py-3.5"
          onPress={onLogout}
        >
          <Text className="font-semibold text-destructive">Log out</Text>
        </Pressable>

        <Text className="text-center text-xs text-muted-foreground">
          Sri Aparajitha · v{OTA_BUILD}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
