import { View } from "react-native";
import { Skeleton, SkeletonTheme } from "../skeleton";

/** Context-aware first-load shimmer for the Deliveries screen — mirrors the
 *  active-run body (the "+ Add delivery" action, the "Deliveries done" label,
 *  and a few delivery-stop cards) so the placeholder matches what loads in.
 *  The real DeliveryHeader stays rendered above it (not shimmered). */
export function DeliverySkeleton() {
  return (
    <SkeletonTheme>
      <View className="gap-3 px-5 py-4">
        {/* + Add delivery button */}
        <Skeleton width="100%" height={48} radius={24} />
        {/* "Deliveries done (N)" section label */}
        <Skeleton width={150} height={11} />
        {/* Delivery-stop cards: customer name + photo-count subline */}
        {[0, 1, 2].map((i) => (
          <View key={i} className="gap-2 rounded-3xl border border-border bg-card p-3">
            <Skeleton width="55%" height={15} />
            <Skeleton width="30%" height={11} />
          </View>
        ))}
      </View>
    </SkeletonTheme>
  );
}
