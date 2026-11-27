import { Text } from "react-native";

/** Minimal centered day label between chat sections ("Today", "Yesterday", …). */
export function ChatDaySeparator({ label }: { readonly label: string }) {
  return (
    <Text className="self-center py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {label}
    </Text>
  );
}
