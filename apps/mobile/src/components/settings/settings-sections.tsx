import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Row, SectionLabel } from "./settings-rows";

/** Account and App sections of the Settings screen. */
export function SettingsSections() {
  return (
    <>
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
          <Row label="Help" onPress={() => router.push("/settings/about")} />
        </View>
      </View>
    </>
  );
}
