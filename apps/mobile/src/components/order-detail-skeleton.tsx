import { View } from "react-native";
import { Skeleton, SkeletonTheme } from "./skeleton";

/** First-load placeholder for the order sheet: header + line items + totals. */
export function OrderDetailSkeleton() {
  return (
    <SkeletonTheme>
      {/* Header: order code + status chip */}
      <View className="mb-1 flex-row items-center justify-between">
        <Skeleton width={120} height={20} />
        <Skeleton width={84} height={22} radius={11} />
      </View>
      <View className="mb-3 mt-1">
        <Skeleton width={110} height={11} />
      </View>
      {/* Line items */}
      <View className="overflow-hidden rounded-xl border border-border">
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            className={`flex-row items-center justify-between gap-3 px-4 py-2.5 ${
              i > 0 ? "border-t border-border" : ""
            }`}
          >
            <View className="flex-1 gap-1.5">
              <Skeleton width="70%" height={13} />
              <Skeleton width="40%" height={10} />
            </View>
            <Skeleton width={40} height={13} />
          </View>
        ))}
      </View>
      {/* Totals bar */}
      <View className="mt-3 flex-row items-center justify-between rounded-xl bg-secondary px-4 py-3">
        <Skeleton width={44} height={13} />
        <Skeleton width={72} height={13} />
      </View>
    </SkeletonTheme>
  );
}
