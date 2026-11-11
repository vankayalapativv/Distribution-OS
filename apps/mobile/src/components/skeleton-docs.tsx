/**
 * Composed skeletons: a generic list of N shimmer rows, and a full-page
 * document placeholder for the invoice preview while the PDF downloads.
 */
import { View } from "react-native";
import { Skeleton } from "./skeleton-block";
import { SkeletonTheme } from "./skeleton-sweep";

/** N copies of a skeleton row, spaced like the real list, one shared sweep. */
export function SkeletonList({
  count,
  row: Row,
}: {
  readonly count: number;
  readonly row: () => React.JSX.Element;
}) {
  return (
    <SkeletonTheme>
      <View className="gap-2">
        {Array.from({ length: count }, (_, i) => (
          <Row key={i} />
        ))}
      </View>
    </SkeletonTheme>
  );
}

/** Full-page document placeholder — a paper-shaped card with a title, body
 *  lines, a small amount table and a total. Mirrors an invoice PDF while it
 *  downloads (invoice preview screen), instead of a bare centered spinner. */
export function PdfPageSkeleton() {
  return (
    <SkeletonTheme>
      <View className="flex-1 px-4 py-4">
        <View className="flex-1 gap-3 rounded-xl border border-border bg-card p-5">
          <Skeleton width="45%" height={18} />
          <Skeleton width="30%" height={12} />
          <View className="h-1" />
          <Skeleton width="100%" height={11} />
          <Skeleton width="92%" height={11} />
          <Skeleton width="96%" height={11} />
          <View className="h-2" />
          {Array.from({ length: 6 }, (_, i) => (
            <View key={i} className="flex-row items-center justify-between">
              <Skeleton width="55%" height={12} />
              <Skeleton width="18%" height={12} />
            </View>
          ))}
          <View className="flex-1" />
          <View className="items-end gap-2">
            <Skeleton width="40%" height={12} />
            <Skeleton width="32%" height={18} />
          </View>
        </View>
      </View>
    </SkeletonTheme>
  );
}
