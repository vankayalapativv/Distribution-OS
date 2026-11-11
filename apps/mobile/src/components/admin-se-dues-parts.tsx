import { Text, View } from "react-native";
import { Skeleton, SkeletonTheme } from "./skeleton";
import { type SeDues } from "../lib/admin-dues";

function rupees(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

// Tabular figures so the right-aligned amounts line up digit-for-digit (RN needs
// the fontVariant prop; NativeWind's tabular-nums class doesn't map to it).
const NUM = { fontVariant: ["tabular-nums" as const] };

/** Filled list of SEs, ranked highest outstanding first. */
export function SeDuesRows({ rows }: { readonly rows: SeDues[] }) {
  return (
    <View>
      {rows.map((se, i) => (
        <View
          key={se.executiveId}
          className={`flex-row items-center justify-between gap-3 py-2.5 ${
            i > 0 ? "border-t border-border" : ""
          }`}
        >
          <Text className="flex-1 text-[15px] font-medium text-card-foreground" numberOfLines={1}>
            {se.executiveName}
          </Text>
          <View className="items-end">
            <Text className="text-[15px] font-bold text-card-foreground" style={NUM}>
              {rupees(se.totalOutstanding)}
            </Text>
            <Text className="mt-0.5 text-[11px] text-muted-foreground">
              {se.customerCount} {se.customerCount === 1 ? "customer" : "customers"}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Loading placeholder that mirrors the row layout. */
export function SeDuesSkeleton() {
  return (
    <SkeletonTheme>
      <View>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            className={`flex-row items-center justify-between py-2.5 ${
              i > 0 ? "border-t border-border" : ""
            }`}
          >
            <Skeleton width="45%" height={15} />
            <View className="items-end gap-1.5">
              <Skeleton width={72} height={15} />
              <Skeleton width={54} height={10} />
            </View>
          </View>
        ))}
      </View>
    </SkeletonTheme>
  );
}
