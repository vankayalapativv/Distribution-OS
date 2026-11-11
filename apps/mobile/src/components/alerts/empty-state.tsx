import { Text, View } from "react-native";

/** Empty-state card shown when a SE Alerts segment has no items. */
export function EmptyState({ title, body }: { readonly title: string; readonly body: string }) {
  return (
    <View className="items-center gap-1 rounded-3xl border border-border bg-card px-4 py-8">
      <Text className="text-sm font-medium text-card-foreground">{title}</Text>
      <Text className="px-6 text-center text-xs text-muted-foreground">{body}</Text>
    </View>
  );
}
