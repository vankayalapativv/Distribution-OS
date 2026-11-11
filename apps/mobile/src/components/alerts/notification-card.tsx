import { Pressable, Text, View } from "react-native";
import type { ReactNode } from "react";
import { Icon } from "../icon";
import { timeLabel } from "../../lib/alerts-format";
import type { InvoiceNotification } from "../../lib/invoice-notifications";

/** One SE notification row: tap to open/mark-read, trash to delete. Shared by
 *  all three sections so the delete affordance is consistent. */
export function NotificationCard({
  n,
  accent,
  trailing,
  onPress,
  onDelete,
}: {
  readonly n: InvoiceNotification;
  readonly accent: string;
  readonly trailing?: ReactNode;
  readonly onPress: () => void;
  readonly onDelete: (id: string) => void;
}) {
  return (
    <View
      className={`flex-row items-center gap-2 rounded-3xl border px-4 py-3 ${
        n.readAt ? "border-border bg-card" : accent
      }`}
    >
      <Pressable className="flex-1 flex-row items-center gap-3" onPress={onPress}>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-card-foreground">{n.title}</Text>
          {n.body ? (
            <Text className="mt-0.5 text-xs text-muted-foreground">{n.body}</Text>
          ) : null}
          <Text className="mt-1 text-[11px] text-muted-foreground">
            {timeLabel(n.createdAt)}
            {n.readAt ? "" : " · new"}
          </Text>
        </View>
        {trailing}
      </Pressable>
      <Pressable hitSlop={8} className="pl-1" onPress={() => onDelete(n.id)}>
        <Icon name="trash-outline" size={18} color="#9ca3af" />
      </Pressable>
    </View>
  );
}
