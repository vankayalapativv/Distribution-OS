import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

/** Fixed top bar: back arrow, customer name + code, edit shortcut. */
export function CustomerTopBar({
  id,
  name,
  code,
}: {
  readonly id: string;
  readonly name: string;
  readonly code: string | null;
}) {
  return (
    <View className="flex-row items-center gap-3 border-b border-border px-5 py-4">
      <Pressable onPress={() => router.back()} hitSlop={8}>
        <Text className="text-2xl text-foreground">‹</Text>
      </Pressable>
      <View className="flex-1">
        <Text className="text-xl font-bold text-foreground" numberOfLines={1}>
          {name}
        </Text>
        {code ? <Text className="text-xs text-muted-foreground">{code}</Text> : null}
      </View>
      <Pressable
        className="rounded-full border border-border bg-card px-3.5 py-2"
        onPress={() => router.push({ pathname: "/customer/edit", params: { id, name } })}
        hitSlop={8}
      >
        <Text className="text-sm font-medium text-secondary-foreground">✎ Edit</Text>
      </Pressable>
    </View>
  );
}
