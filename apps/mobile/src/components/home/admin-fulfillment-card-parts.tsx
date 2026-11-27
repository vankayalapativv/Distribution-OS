import { View } from "react-native";
import { Skeleton, SkeletonTheme } from "../skeleton";

// Split a group's stages into rows of two (so e.g. Invoiced + Partial del. share a
// row); an odd trailing tile gets its own row and fills the width.
export function chunkPairs<T>(arr: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += 2) out.push(arr.slice(i, i + 2));
  return out;
}

/** One shimmer tile — matches a real fulfillment Tile (flex-1, rounded-xl). */
function SkelTile() {
  return <Skeleton height={60} radius={12} style={{ flex: 1, flexBasis: 0 }} />;
}

/** One shimmer section: a label bar + tile rows (`rows[i]` = tiles in that row). */
function SkelSection({ first, rows }: { readonly first?: boolean; readonly rows: number[] }) {
  return (
    <View className={first ? "mt-3" : "mt-4 border-t border-border pt-4"}>
      <Skeleton width={96} height={11} />
      <View className="mt-2 gap-2">
        {rows.map((n, r) => (
          <View key={r} className="flex-row gap-2">
            {Array.from({ length: n }, (_, c) => (
              <SkelTile key={c} />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Loading placeholder for {@link AdminFulfillmentCard} — mirrors the real
 *  card's structure: a title, then the three stage groups (In progress →
 *  Completed → Returns), each a section label above rows of two tiles. */
export function FulfillmentCardSkeleton() {
  return (
    <SkeletonTheme>
      <View className="rounded-3xl border border-border bg-card p-4">
        <Skeleton width={120} height={13} />
        <SkelSection first rows={[2, 1]} />
        <SkelSection rows={[2]} />
        <SkelSection rows={[2]} />
      </View>
    </SkeletonTheme>
  );
}
