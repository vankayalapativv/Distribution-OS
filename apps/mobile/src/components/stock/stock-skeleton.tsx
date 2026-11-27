import { View } from "react-native";
import { Skeleton, SkeletonTheme } from "../skeleton";

/**
 * First-load placeholder for the Stock list. Mirrors the pack-chips row (Design
 * B): a name + brand·segment line and a total on the right, then a row of pack
 * chips — so the shimmer reads as the same screen loading, not a generic spinner.
 * Chip count alternates (1 or 2) to echo products with one vs several pack sizes.
 */
export function StockSkeleton() {
  return (
    <SkeletonTheme>
      <View className="pt-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <View key={i} className="border-b border-border px-5 py-3.5">
            <View className="flex-row items-start gap-3">
              <View className="flex-1 gap-2">
                <Skeleton width={170} height={14} />
                <Skeleton width={92} height={11} />
              </View>
              <View className="items-end gap-1.5">
                <Skeleton width={44} height={15} />
                <Skeleton width={26} height={9} />
              </View>
            </View>
            <View className="mt-2.5 flex-row gap-2">
              <Skeleton width={70} height={30} radius={12} />
              {i % 2 === 0 ? <Skeleton width={58} height={30} radius={12} /> : null}
            </View>
          </View>
        ))}
      </View>
    </SkeletonTheme>
  );
}
