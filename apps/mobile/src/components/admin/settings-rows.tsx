import { Pressable, Text } from "react-native";

export function Row({ label, onPress }: { readonly label: string; readonly onPress: () => void }) {
  return (
    <Pressable
      className="flex-row items-center justify-between border-t border-border px-4 py-3.5 active:bg-secondary"
      onPress={onPress}
    >
      <Text className="text-base text-card-foreground">{label}</Text>
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
