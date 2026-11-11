import { View } from "react-native";
import { Skeleton, SkeletonTheme } from "../skeleton";

/** First-load placeholder shaped like the real card: header, two lead stats,
 *  and the per-segment oil rows. */
export function PerformanceCardSkeleton() {
  return (
    <View className="border border-border bg-card p-4 rounded-3xl shadow-sm">
      <SkeletonTheme>
        <View className="mb-3 flex-row items-center justify-between">
          <Skeleton width={110} height={15} />
          <Skeleton width={150} height={26} radius={9} />
        </View>
        <View className="mb-4 flex-row gap-3">
          {[0, 1].map((i) => (
            <View key={i} className="flex-1 gap-2 rounded-xl border border-border bg-secondary px-3 py-2.5">
              <Skeleton width="55%" height={11} />
              <Skeleton width="70%" height={20} />
              <Skeleton width="100%" height={6} radius={3} />
            </View>
          ))}
        </View>
        <Skeleton width={140} height={11} style={{ marginBottom: 12 }} />
        <View className="gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} className="flex-row items-center gap-3">
              <Skeleton width={74} height={13} />
              <View className="flex-1">
                <Skeleton width="100%" height={6} radius={3} />
              </View>
              <Skeleton width={56} height={12} />
            </View>
          ))}
        </View>
      </SkeletonTheme>
    </View>
  );
}
