import { Pressable, Text, View } from "react-native";
import { Skeleton } from "../skeleton";
import { compactInr } from "../../lib/format";
import { toneForPosition } from "./dues-card-strip";
import type { DuesBucketKey, DuesSummary } from "../../lib/dues";

// Four placeholder cells for the loading strip (the real band count is
// server-driven and unknown until the summary loads).
const SKELETON_CELLS = [null, null, null, null];

/** Data-only region of the SA dues card (total, customer count, ageing strip).
 *  The SAME JSX reads `summary`: null shows shimmers, present shows values.
 *
 *  The ageing bands are SERVER-DRIVEN — each enterprise defines its own bands in
 *  onboarding, and the API returns them with their own key/label. So the strip
 *  renders straight from `summary.buckets`; it must NOT hardcode the legacy fixed
 *  keys ("0_30"…), which no longer exist (doing so made every bucket read 0 while
 *  the header total was correct). The colour grades by POSITION across whatever
 *  bands the enterprise defines (same as the SE card's DuesCardStrip). */
export function AdminDuesBody({
  summary,
  onBucket,
}: {
  readonly summary: DuesSummary | null;
  /** Tap a single band cell → open the dues screen on that band's tab. */
  readonly onBucket?: (k: DuesBucketKey) => void;
}) {
  const cells = summary ? summary.buckets : SKELETON_CELLS;
  return (
    <>
      {summary ? (
        <Text className="text-2xl font-extrabold text-card-foreground">
          ₹{summary.totalOutstanding.toLocaleString("en-IN")}
        </Text>
      ) : (
        <Skeleton width={150} height={26} style={{ marginVertical: 3 }} />
      )}

      {/* "outstanding" is static; the customer count is server data → shimmers. */}
      <View className="mb-3 mt-0.5 flex-row items-center gap-1.5">
        <Text className="text-xs text-muted-foreground">outstanding</Text>
        {summary ? (
          <Text className="text-xs text-muted-foreground">
            · {summary.totalCustomers} {summary.totalCustomers === 1 ? "customer" : "customers"}
          </Text>
        ) : (
          <Skeleton width={72} height={11} />
        )}
      </View>

      <View className="flex-row overflow-hidden rounded-xl border border-border">
        {cells.map((bucket, i) => (
          <Pressable
            key={bucket?.key ?? i}
            onPress={bucket ? () => onBucket?.(bucket.key) : undefined}
            className={`flex-1 items-center py-2 active:bg-secondary ${i < cells.length - 1 ? "border-r border-border" : ""}`}
          >
            {bucket ? (
              <>
                <Text className={`text-base font-extrabold ${toneForPosition(i, cells.length)}`}>
                  {bucket.customers}
                </Text>
                <Text className="mt-0.5 text-[11px] font-semibold text-card-foreground">
                  {compactInr(bucket.outstanding)}
                </Text>
                <Text className="mt-0.5 text-center text-[10px] text-muted-foreground">
                  {bucket.label}
                </Text>
              </>
            ) : (
              <>
                <Skeleton width={22} height={16} />
                <Skeleton width={34} height={11} style={{ marginTop: 6 }} />
                <Skeleton width={30} height={10} style={{ marginTop: 6 }} />
              </>
            )}
          </Pressable>
        ))}
      </View>
    </>
  );
}
