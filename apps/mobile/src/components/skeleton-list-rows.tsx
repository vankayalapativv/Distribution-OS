/**
 * List/card row skeletons — each mirrors the shape of a real list row on a
 * particular screen so the first-load placeholder matches its content.
 */
import { View } from "react-native";
import { Skeleton } from "./skeleton-block";

/** Card-shaped row: title line + status chip — beat stops, activity rows. */
export function CardRowSkeleton() {
  return (
    <View className="rounded-xl border border-border bg-card p-4">
      <View className="flex-row items-center justify-between">
        <Skeleton width="55%" height={16} />
        <Skeleton width={72} height={22} radius={11} />
      </View>
      <View className="mt-2">
        <Skeleton width="40%" height={11} />
      </View>
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

/** Invoice row: number + amount, due line below. */
export function InvoiceRowSkeleton() {
  return (
    <View className="rounded-xl border border-border bg-card p-3">
      <View className="flex-row items-center justify-between">
        <Skeleton width="40%" height={15} />
        <Skeleton width={70} height={15} />
      </View>
      <View className="mt-2">
        <Skeleton width="55%" height={11} />
      </View>
    </View>
  );
}
