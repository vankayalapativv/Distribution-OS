import { View } from "react-native";
import { Skeleton, SkeletonTheme } from "../skeleton";

const WIDTHS = [190, 150, 210, 170] as const;

/**
 * First-load placeholder for the Reminders list. Mirrors a section label plus
 * reminder cards — each a title + time line and a row of action chips (Done /
 * Edit / Delete) — so the shimmer reads as the same screen loading, shown only
 * until the local DB is ready (reminders are local-first).
 */
export function RemindersSkeleton() {
  return (
    <SkeletonTheme>
      <View className="gap-2">
        <Skeleton width={120} height={11} style={{ marginLeft: 4, marginTop: 2, marginBottom: 2 }} />
        {WIDTHS.map((w, i) => (
          <View key={i} className="gap-3 rounded-3xl border border-border bg-card px-4 py-3">
            <View className="gap-1.5">
              <Skeleton width={w} height={14} />
              <Skeleton width={w - 60} height={11} />
            </View>
            <View className="flex-row gap-2">
              <Skeleton width={76} height={30} radius={10} />
              <Skeleton width={66} height={30} radius={10} />
              <Skeleton width={76} height={30} radius={10} />
            </View>
          </View>
        ))}
      </View>
    </SkeletonTheme>
  );
}
