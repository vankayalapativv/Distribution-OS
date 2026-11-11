import { type ComponentProps } from "react";
import { Pressable, Text } from "react-native";
import { Icon } from "../icon";

const TONE_COLOR: Record<string, string> = { primary: "#2563eb", danger: "#dc2626" };
const TONE_TEXT: Record<string, string> = { primary: "text-primary", danger: "text-red-600" };

type IconName = ComponentProps<typeof Icon>["name"];

/** One tappable action under a reminder row (Done / Edit / Delete). */
export function RowAction({
  icon,
  label,
  onPress,
  tone = "neutral",
}: {
  readonly icon: IconName;
  readonly label: string;
  readonly onPress: () => void;
  readonly tone?: "neutral" | "primary" | "danger";
}) {
  const color = TONE_COLOR[tone] ?? "#6b7280";
  const text = TONE_TEXT[tone] ?? "text-muted-foreground";
  return (
    <Pressable
      className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-secondary py-2"
      hitSlop={6}
      onPress={onPress}
    >
      <Icon name={icon} size={16} color={color} />
      <Text className={`text-xs font-semibold ${text}`}>{label}</Text>
    </Pressable>
  );
}
