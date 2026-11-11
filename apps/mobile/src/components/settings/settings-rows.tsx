import { Pressable, Text, View } from "react-native";

export function Row({
  label,
  hint,
  onPress,
  danger,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly onPress: () => void;
  readonly danger?: boolean;
}) {
  return (
    <Pressable
      className="flex-row items-center justify-between border-t border-border px-4 py-3.5 active:bg-secondary"
      onPress={onPress}
    >
      <View className="flex-1 pr-2">
        <Text className={`text-base ${danger ? "text-destructive" : "text-card-foreground"}`}>
          {label}
        </Text>
        {hint ? <Text className="mt-0.5 text-xs text-muted-foreground">{hint}</Text> : null}
      </View>
      <Text className="text-lg text-muted-foreground">›</Text>
    </Pressable>
  );
}

export function SectionLabel({ children }: { readonly children: string }) {
  return (
    <Text className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </Text>
  );
}
