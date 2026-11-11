import { View } from "react-native";
import { Skeleton, SkeletonTheme } from "../skeleton";

// Split a group's stages into rows of two (so e.g. Invoiced + Partial del. share a
// row); an odd trailing tile gets its own row and fills the width.
export function chunkPairs<T>(arr: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += 2) out.push(arr.slice(i, i + 2));
  return out;
}

/** Loading placeholder for {@link AdminFulfillmentCard} — title + a row of tiles. */
export function FulfillmentCardSkeleton() {
  return (
    <SkeletonTheme>
      <View className="rounded-3xl border border-border bg-card p-4">
        <Skeleton width={120} height={13} />
        <View className="mt-3 flex-row gap-2">
          <Skeleton width="31%" height={56} radius={12} />
          <Skeleton width="31%" height={56} radius={12} />
          <Skeleton width="31%" height={56} radius={12} />
        </View>
      </View>
    </SkeletonTheme>
  );
}
