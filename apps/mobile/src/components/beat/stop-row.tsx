import { router } from "expo-router";
import { Linking, Pressable, Text, View } from "react-native";
import type { BeatStop } from "../../lib/beat/today-beat-online";
import { activityChip } from "../../lib/beat/activity-chip";
import { effectiveStopStatus } from "../../lib/beat/stop-status";
import { dueBucketMeta } from "../../lib/dues-bucket";
import { rupeesLabel } from "../home/performance-card-format";
import { StatusPill } from "./status-pill";

/** One ordered beat stop: sequence badge, name, city, tappable phone, status
 *  pill. The row opens the normal customer screen (check-in / order / collection
 *  all live there); tapping the phone opens the dialer instead. */
export function StopRow({ stop }: { readonly stop: BeatStop }) {
  const city = stop.city || "";
  const phone = stop.contactPhone || "";
  const due = stop.outstanding > 0 ? dueBucketMeta(stop.dueBucket) : null;
  // Recency chips — last order + last collection, graded green→orange→red. A beat
  // payload cached before these fields existed omits them (undefined); hide the
  // chip then rather than show a misleading "No orders/collections yet".
  const orderChip = stop.lastOrderDate !== undefined ? activityChip("order", stop.lastOrderDate) : null;
  const collectionChip = stop.lastCollectionDate !== undefined ? activityChip("collection", stop.lastCollectionDate) : null;
  return (
    <Pressable
      className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-4"
      onPress={() =>
        router.push({
          pathname: "/customer/[id]",
          params: { id: stop.customerId, name: stop.legalName ?? "" },
        })
      }
    >
      <View className="h-8 w-8 items-center justify-center rounded-full bg-secondary">
        <Text className="text-sm font-bold text-foreground">{stop.sequenceNo}</Text>
      </View>
      <View className="flex-1">
        <Text className="font-semibold text-card-foreground" numberOfLines={1}>
          {stop.legalName || "Customer"}
        </Text>
        {city ? (
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {city}
          </Text>
        ) : null}
        {phone ? (
          <Pressable
            hitSlop={6}
            onPress={() => Linking.openURL(`tel:${phone}`)}
          >
            <Text className="mt-0.5 text-xs font-medium text-primary" numberOfLines={1}>
              {phone}
            </Text>
          </Pressable>
        ) : null}
        {stop.outstanding > 0 ? (
          <View className={`mt-1.5 self-start rounded-full px-2 py-0.5 ${due?.bgClass ?? "bg-secondary"}`}>
            <Text className={`text-[11px] font-semibold ${due?.textClass ?? "text-foreground"}`}>
              Due {rupeesLabel(stop.outstanding)}
              {due ? ` · ${due.short}` : ""}
            </Text>
          </View>
        ) : null}
        {/* Last order / last collection recency, side by side. */}
        {orderChip || collectionChip ? (
          <View className="mt-1.5 flex-row flex-wrap gap-1.5">
            {orderChip ? (
              <View className={`self-start rounded-full px-2 py-0.5 ${orderChip.bgClass}`}>
                <Text className={`text-[11px] font-semibold ${orderChip.textClass}`}>{orderChip.text}</Text>
              </View>
            ) : null}
            {collectionChip ? (
              <View className={`self-start rounded-full px-2 py-0.5 ${collectionChip.bgClass}`}>
                <Text className={`text-[11px] font-semibold ${collectionChip.textClass}`}>{collectionChip.text}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      <StatusPill status={effectiveStopStatus(stop.stopStatus)} />
    </Pressable>
  );
}
