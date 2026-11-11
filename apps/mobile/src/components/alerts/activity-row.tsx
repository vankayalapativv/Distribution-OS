import { Pressable, Text, View } from "react-native";
import { Icon } from "../icon";
import { timeLabel } from "../../lib/alerts-format";
import type { InvoiceNotification } from "../../lib/invoice-notifications";

/** Per-event icon + tint for the Super Admin activity feed. */
export const ACTIVITY_ICON: Record<string, { name: string; color: string }> = {
  admin_order: { name: "cart-outline", color: "#2563eb" },
  admin_collection: { name: "cash-outline", color: "#16a34a" },
  admin_visit: { name: "location-outline", color: "#f59e0b" },
  admin_customer: { name: "person-add-outline", color: "#8b5cf6" },
  admin_login: { name: "log-in-outline", color: "#6b7280" },
};

/** One Super Admin activity row: event icon, title/body/time, unread dot, and a
 *  trash button to delete (dismiss) the alert. */
export function ActivityRow({
  n,
  onPress,
  onDelete,
}: {
  readonly n: InvoiceNotification;
  readonly onPress: () => void;
  readonly onDelete?: () => void;
}) {
  const icon = ACTIVITY_ICON[n.type] ?? { name: "ellipse-outline", color: "#6b7280" };
  const unread = !n.readAt;
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-3 rounded-2xl border p-3 ${
        unread ? "border-primary/40 bg-primary/5" : "border-border bg-card"
      }`}
    >
      <View className="h-9 w-9 items-center justify-center rounded-full bg-secondary">
        <Icon name={icon.name as never} size={18} color={icon.color} />
      </View>
      <View className="flex-1">
        <Text className="text-[15px] font-semibold text-card-foreground">{n.title}</Text>
        {n.body ? <Text className="mt-0.5 text-sm text-muted-foreground">{n.body}</Text> : null}
        <Text className="mt-0.5 text-xs text-muted-foreground">{timeLabel(n.createdAt)}</Text>
      </View>
      {unread ? <View className="h-2 w-2 rounded-full bg-primary" /> : null}
      {onDelete ? (
        <Pressable
          onPress={onDelete}
          hitSlop={10}
          accessibilityLabel="Delete alert"
          className="rounded-full p-1.5 active:bg-secondary"
        >
          <Icon name="trash-outline" size={18} color="#9ca3af" />
        </Pressable>
      ) : null}
    </Pressable>
  );
}
