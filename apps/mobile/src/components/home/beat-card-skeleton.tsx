import { View } from "react-native";
import { Skeleton, SkeletonTheme } from "../skeleton";

/** First-load / pull-to-refresh placeholder shaped like the beat card:
 *  title + "X of Y stops done" on one row, then the thin progress bar. */
export function BeatCardSkeleton() {
  return (
    <View className="rounded-3xl border border-border bg-card p-4 shadow-sm">
      <SkeletonTheme>
        <View className="flex-row items-center justify-between">
          <Skeleton width={90} height={14} />
          <Skeleton width={130} height={12} />
        </View>
        <View className="mt-3">
          <Skeleton width="100%" height={8} radius={999} />
        </View>
      </SkeletonTheme>
    </View>
  );
}
