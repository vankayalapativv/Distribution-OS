import { View } from "react-native";
import { Skeleton, SkeletonTheme } from "./skeleton";

export function SegmentSalesSkeleton() {
  return (
    <SkeletonTheme>
      <View className="gap-3">
        {[0, 1, 2, 3].map((i) => (
          <View key={i} className="flex-row items-center gap-2.5">
            <Skeleton width={24} height={24} radius={12} />
            <Skeleton width="40%" height={12} />
            <View className="flex-1" />
            <Skeleton width={44} height={12} />
          </View>
        ))}
      </View>
    </SkeletonTheme>
  );
}
