/**
 * Feed/form/ledger row skeletons — richer rows with trailing icons, stacked
 * lines or right-aligned figures, each shaped to its real screen.
 */
import { View } from "react-native";
import { Skeleton } from "./skeleton-block";

/** Alerts feed row: title + body + time on the left, a trailing action icon —
 *  mirrors the notification cards on the Alerts tab (rounded-3xl). */
export function NotificationRowSkeleton() {
  return (
    <View className="flex-row items-center gap-3 rounded-3xl border border-border bg-card px-4 py-3.5">
      <View className="flex-1 gap-1.5">
        <Skeleton width="65%" height={14} />
        <Skeleton width="45%" height={11} />
        <Skeleton width="30%" height={10} />
      </View>
      <Skeleton width={20} height={20} radius={10} />
    </View>
  );
}

/** Dues drill-down row: customer name + oldest-invoice line left, outstanding
 *  amount right — mirrors dues/[bucket] rows. */
export function DuesRowSkeleton() {
  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <View className="flex-1 gap-1.5">
        <Skeleton width="55%" height={14} />
        <Skeleton width="72%" height={11} />
      </View>
      <Skeleton width={60} height={15} />
    </View>
  );
}

/** Labeled form field: a short label bar above a full-width input block —
 *  mirrors the label + bordered TextInput rows on the edit-profile / edit-
 *  customer forms. */
export function FormFieldSkeleton() {
  return (
    <View className="gap-2">
      <Skeleton width={96} height={12} />
      <Skeleton width="100%" height={44} radius={8} />
    </View>
  );
}

/** Order / collection record card: title + status pill on top, one subline —
 *  the rounded-3xl "Last 5 orders/collections" rows on the customer page. */
export function RecordRowSkeleton() {
  return (
    <View className="rounded-3xl border border-border bg-card p-3">
      <View className="flex-row items-center justify-between">
        <Skeleton width="42%" height={15} />
        <Skeleton width={88} height={22} radius={11} />
      </View>
      <View className="mt-2">
        <Skeleton width="50%" height={11} />
      </View>
    </View>
  );
}

/** Ledger transaction row: two stacked lines on the left (date + narration)
 *  and two right-aligned numbers (amount + running balance) — mirrors the
 *  rounded-2xl rows on the customer ledger. */
export function LedgerRowSkeleton() {
  return (
    <View className="rounded-2xl border border-border bg-card px-3.5 py-3">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1.5">
          <Skeleton width="45%" height={12} />
          <Skeleton width="65%" height={11} />
        </View>
        <View className="items-end gap-1.5">
          <Skeleton width={70} height={13} />
          <Skeleton width={54} height={10} />
        </View>
      </View>
    </View>
  );
}
