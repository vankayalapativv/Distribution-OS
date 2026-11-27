/**
 * List/card row skeletons — each mirrors the shape of a real list row on a
 * particular screen so the first-load placeholder matches its content.
 */
import { View } from "react-native";
import { Skeleton } from "./skeleton-block";

/** Beat stop row: leading sequence badge, name + city stack, trailing status
 *  pill — mirrors the real StopRow on Today's Beat. */
export function BeatStopRowSkeleton() {
  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-4">
      <Skeleton width={32} height={32} radius={16} />
      <View className="flex-1 gap-2">
        <Skeleton width="55%" height={15} />
        <Skeleton width="38%" height={11} />
      </View>
      <Skeleton width={56} height={20} radius={10} />
    </View>
  );
}

/** List row with name + trailing code — customer directory. */
export function ListRowSkeleton() {
  return (
    <View className="rounded-xl border border-border bg-card p-4">
      <View className="flex-row items-center justify-between">
        <Skeleton width="60%" height={15} />
        <Skeleton width={64} height={11} />
      </View>
    </View>
  );
}

/** Contacts-list row: round avatar + name + subtitle — the Customers tab.
 *  Flat (no card), 64dp tall and contiguous to match the real rows. */
export function ContactRowSkeleton() {
  return (
    <View className="flex-row items-center gap-3 bg-secondary px-5" style={{ height: 64 }}>
      <Skeleton width={44} height={44} radius={22} />
      <View className="flex-1 gap-2">
        <Skeleton width="52%" height={15} />
        <Skeleton width="34%" height={11} />
      </View>
    </View>
  );
}

/** Product picker row: name + subtext left, "Add" action right —
 *  mirrors the New Order / logistics picker card rows. */
export function PickerRowSkeleton() {
  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
      <View className="flex-1 gap-1.5">
        <Skeleton width="70%" height={15} />
        <Skeleton width="30%" height={11} />
      </View>
      <Skeleton width={34} height={15} />
    </View>
  );
}

/** Delivery invoice-picker row: invoice no + customer + address stacked on the
 *  left, a round map button on the right — mirrors the Add-delivery picker. */
export function DeliveryPickerRowSkeleton() {
  return (
    <View className="flex-row items-center gap-3 rounded-3xl border border-border bg-card p-3.5">
      <View className="flex-1 gap-1.5">
        <Skeleton width="40%" height={15} />
        <Skeleton width="60%" height={13} />
        <Skeleton width="50%" height={11} />
      </View>
      <Skeleton width={40} height={40} radius={20} />
    </View>
  );
}
