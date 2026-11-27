import { Pressable, ScrollView, Text, View } from "react-native";
import { Icon } from "../icon";
import type { CheckinMarker } from "../../lib/admin-tracking";
import { checkinTime, rupees } from "../../lib/tracking-overlays";
import { CardShell } from "./tracking-card-shell";

/** Check-in pin card — customer (opens them), planned/unplanned + time, and the
 *  orders (litres) + collections (₹) made at that visit. */
export function CheckinCard({
  checkin,
  onClose,
  onOpen,
}: {
  readonly checkin: CheckinMarker;
  readonly onClose: () => void;
  readonly onOpen: (c: CheckinMarker) => void;
}) {
  const time = checkinTime(checkin.checkInAt);
  const planned = checkin.planned === "planned";
  return (
    <CardShell onClose={onClose}>
      <Pressable onPress={() => onOpen(checkin)} className="flex-row items-center gap-1.5 self-start pr-8">
        <Text className="text-base font-bold text-primary">{checkin.customerName}</Text>
        <Icon name="chevron-forward" size={16} color="#2563eb" />
      </Pressable>
      <View className="flex-row items-center gap-2">
        <View
          className="self-start rounded-full px-2 py-0.5"
          style={{ backgroundColor: planned ? "#dcfce7" : "#e0e7ff" }}
        >
          <Text className="text-[11px] font-semibold" style={{ color: planned ? "#15803d" : "#4338ca" }}>
            {planned ? "Planned visit" : "Unplanned visit"}
          </Text>
        </View>
        {time ? <Text className="text-xs text-muted-foreground">{time}</Text> : null}
      </View>

      <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false}>
        <Text className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Orders
        </Text>
        {checkin.orders.length ? (
          checkin.orders.map((o) => (
            <View key={o.id} className="flex-row justify-between py-0.5">
              <Text className="text-[13px] text-foreground">{o.code}</Text>
              <Text className="text-[13px] font-semibold text-foreground">{o.litres} L</Text>
            </View>
          ))
        ) : (
          <Text className="py-0.5 text-[13px] text-muted-foreground">No orders</Text>
        )}

        <Text className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Collections
        </Text>
        {checkin.collections.length ? (
          checkin.collections.map((c) => (
            <View key={c.id} className="flex-row justify-between py-0.5">
              <Text className="text-[13px] text-foreground">{c.code}</Text>
              <Text className="text-[13px] font-semibold text-foreground">{rupees(c.amount)}</Text>
            </View>
          ))
        ) : (
          <Text className="py-0.5 text-[13px] text-muted-foreground">No collections</Text>
        )}
      </ScrollView>
    </CardShell>
  );
}
