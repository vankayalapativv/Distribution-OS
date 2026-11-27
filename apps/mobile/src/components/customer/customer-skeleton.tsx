import { View } from "react-native";
import { RecordRowSkeleton, Skeleton, SkeletonTheme } from "../skeleton";

/** Context-aware first-load shimmer mirroring the real customer screen: hero
 *  card, Check-in button, action row, and the two "Last 5" record sections.
 *  `isAdmin` matches the real action-row count (Super Admin has no Market
 *  button → 4 actions; a Sales Executive has 5). One sweep. */
export function CustomerSkeleton({ isAdmin = false }: { readonly isAdmin?: boolean }) {
  const actions = isAdmin ? [0, 1, 2, 3] : [0, 1, 2, 3, 4];
  return (
    <SkeletonTheme>
      <View className="gap-5 px-5 py-4">
        {/* Hero: address line + phone pill + balance */}
        <View className="gap-3 rounded-3xl border border-border bg-card p-4">
          <Skeleton width="70%" height={13} />
          <View className="flex-row items-center justify-between">
            <Skeleton width={128} height={34} radius={17} />
            <View className="items-end gap-1.5">
              <Skeleton width={48} height={11} />
              <Skeleton width={90} height={22} />
            </View>
          </View>
        </View>

        {/* Check-in button (full-width) */}
        <Skeleton width="100%" height={46} radius={16} />

        {/* Action buttons row (Order / Collect / [Market] / Ledger / Notes) */}
        <View className="flex-row gap-2">
          {actions.map((i) => (
            <Skeleton key={i} width="100%" height={58} radius={16} style={{ flex: 1, flexBasis: 0 }} />
          ))}
        </View>

        {/* Last 5 orders + Last 5 collections */}
        {[0, 1].map((s) => (
          <View key={s} className="gap-2">
            <Skeleton width={110} height={12} />
            {[0, 1, 2].map((i) => (
              <RecordRowSkeleton key={i} />
            ))}
          </View>
        ))}
      </View>
    </SkeletonTheme>
  );
}
