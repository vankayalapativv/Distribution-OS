import { View } from "react-native";
import { Skeleton, SkeletonTheme } from "../skeleton";

/** First-load placeholder shaped like the dues card: total + 4-bucket strip. */
export function DuesCardSkeleton() {
  return (
    <View className="rounded-3xl border border-border bg-card p-4">
      <SkeletonTheme>
        <View className="mb-3 flex-row items-center justify-between">
          <Skeleton width={110} height={15} />
          <Skeleton width={64} height={11} />
        </View>
        <Skeleton width={130} height={26} />
        <View className="mb-3 mt-1.5">
          <Skeleton width={160} height={11} />
        </View>
        <View className="flex-row gap-2">
          {[0, 1, 2, 3].map((i) => (
            <View key={i} className="flex-1 items-center gap-1.5 rounded-xl border border-border py-2.5">
              <Skeleton width={24} height={18} />
              <Skeleton width={38} height={10} />
            </View>
          ))}
        </View>
      </SkeletonTheme>
    </View>
  );
}
