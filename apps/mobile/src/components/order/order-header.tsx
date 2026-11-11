import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

/** Shared top bar for the order flow: back arrow, title + customer subtitle,
 *  and an optional trailing slot (the Cart · N shortcut). */
export function OrderHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  readonly title: string;
  readonly subtitle?: string | null;
  readonly onBack: () => void;
  readonly right?: ReactNode;
}) {
  return (
    <View className="flex-row items-center gap-3 bg-secondary px-5 pb-2.5 pt-4">
      <Pressable onPress={onBack} hitSlop={8}>
        <Text className="text-xl text-muted-foreground">←</Text>
      </Pressable>
      <View className="flex-1">
        <Text className="text-lg font-semibold text-foreground">{title}</Text>
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
          {subtitle ?? "Checking credit…"}
        </Text>
      </View>
      {right}
    </View>
  );
}
