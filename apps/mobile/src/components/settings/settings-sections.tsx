import { router } from "expo-router";
import { View } from "react-native";
import { Row, SectionLabel } from "./settings-rows";

/** Account and App sections of the Settings screen. */
export function SettingsSections() {
  return (
    <>
      {/* Account */}
      <View className="gap-2">
        <SectionLabel>Account</SectionLabel>
        <View className="overflow-hidden rounded-3xl border border-border bg-card">
          <Row label="Change password" onPress={() => router.push("/settings/password")} />
        </View>
      </View>

      {/* Expenses */}
      <View className="gap-2">
        <SectionLabel>Expenses</SectionLabel>
        <View className="overflow-hidden rounded-3xl border border-border bg-card">
          <Row label="My expense claims" onPress={() => router.push("/settings/expenses")} />
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
