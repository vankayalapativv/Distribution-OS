import { View } from "react-native";
import { ContactRowSkeleton, SkeletonTheme } from "../skeleton";

/** First-load placeholder for the Customers list — the contact ROWS only.
 *  The real search header stays rendered above it (not shimmered). */
export function CustomersSkeleton() {
  return (
    <SkeletonTheme>
      <View className="pt-1">
        {Array.from({ length: 10 }, (_, i) => (
          <ContactRowSkeleton key={i} />
        ))}
      </View>
    </SkeletonTheme>
  );
}
