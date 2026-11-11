import { Pressable, Text, View } from "react-native";
import { Skeleton } from "../skeleton";
import { compactInr } from "../../lib/format";
import type { DuesBucketKey, DuesSummary } from "../../lib/dues";

const BUCKETS: DuesBucketKey[] = ["0_30", "30_45", "45_60", "60_plus"];
const SHORT: Record<string, string> = {
  "0_30": "0–30d",
  "30_45": "31–45d",
  "45_60": "46–60d",
  "60_plus": "61d+",
};
const COUNT_TONE: Record<string, string> = {
  "0_30": "text-green-600",
  "30_45": "text-amber-600",
  "45_60": "text-orange-600",
  "60_plus": "text-red-600",
};

/** Data-only region of the SA dues card (total, customer count, bucket numbers).
 *  The SAME JSX reads `summary`: null shows shimmers, present shows values.
 *  The caller wraps it in one SkeletonTheme while loading so shimmers sync. */
export function AdminDuesBody({
  summary,
  onBucket,
}: {
  readonly summary: DuesSummary | null;
  /** Tap a single bucket cell → open the dues screen on that bucket's tab. */
  readonly onBucket?: (k: DuesBucketKey) => void;
}) {
  const bucketFor = (k: DuesBucketKey) => summary?.buckets.find((b) => b.key === k);
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
        {BUCKETS.map((k, i) => (
          <Pressable
            key={k}
            onPress={() => onBucket?.(k)}
            className={`flex-1 items-center py-2 active:bg-secondary ${i < BUCKETS.length - 1 ? "border-r border-border" : ""}`}
          >
            {summary ? (
              <>
                <Text className={`text-base font-extrabold ${COUNT_TONE[k] ?? "text-foreground"}`}>
                  {bucketFor(k)?.customers ?? 0}
                </Text>
                <Text className="mt-0.5 text-[11px] font-semibold text-card-foreground">
                  {compactInr(bucketFor(k)?.outstanding ?? 0)}
                </Text>
              </>
            ) : (
              <>
                <Skeleton width={22} height={16} />
                <Skeleton width={34} height={11} style={{ marginTop: 6 }} />
              </>
            )}
            {/* Day-label is static → always shown. */}
            <Text className="mt-0.5 text-[10px] text-muted-foreground">{SHORT[k]}</Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}
