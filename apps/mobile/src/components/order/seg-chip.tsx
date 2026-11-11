import { Pressable, Text } from "react-native";

/** Pill-shaped segment filter chip. */
export function SegChip({
  label,
  active,
  onPress,
}: {
  readonly label: string;
  readonly active: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      className={`rounded-full border px-3.5 py-1.5 ${
        active ? "border-primary bg-accent" : "border-border bg-card"
      }`}
      onPress={onPress}
    >
      <Text className={`text-xs font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}>
        {label}
      </Text>
    </Pressable>
  );
}
