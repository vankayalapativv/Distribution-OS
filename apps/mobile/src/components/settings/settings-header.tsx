import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

/** Back chevron + title bar shared by the settings sub-screens. */
export function SettingsHeader({ title }: { readonly title: string }) {
  return (
    <View className="flex-row items-center gap-3 border-b border-border px-5 py-4">
      <Pressable onPress={() => router.back()} hitSlop={8}>
        <Text className="text-2xl text-foreground">‹</Text>
      </Pressable>
      <Text className="text-xl font-bold text-foreground">{title}</Text>
    </View>
  );
}
