import { View } from "react-native";
import { PickerRowSkeleton, Skeleton, SkeletonTheme } from "../skeleton";

/** Context-aware first-load placeholder that mirrors the real catalogue:
 *  a search box, the brand tab bar, a segment-chip row and ~7 product
 *  rows — all sharing one shimmer sweep. */
export function CatalogueSkeleton() {
  return (
    <SkeletonTheme>
      <View className="flex-1 bg-secondary">
        <View className="px-5 pb-2 pt-1">
          <Skeleton height={40} radius={999} />
        </View>
        <View className="flex-row gap-6 border-b border-border px-5 pb-2.5 pt-1">
          <Skeleton width={36} height={16} />
          <Skeleton width={64} height={16} />
        </View>
        <View className="flex-row gap-2 px-5 py-2.5">
          {[44, 40, 40, 56].map((w, i) => (
            <Skeleton key={i} width={w} height={28} radius={999} />
          ))}
        </View>
        <View className="gap-2 px-4 pt-1">
          {Array.from({ length: 7 }, (_, i) => (
            <PickerRowSkeleton key={i} />
          ))}
        </View>
      </View>
    </SkeletonTheme>
  );
}
