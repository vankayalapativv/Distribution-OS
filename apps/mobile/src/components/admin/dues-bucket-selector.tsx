import { Pressable, Text, View } from "react-native";
import { Skeleton } from "../skeleton";
import { compactInr } from "../../lib/format";
import type { DuesBucketKey } from "../../lib/dues";
import { BUCKETS } from "../../lib/use-admin-dues";

const SHORT: Record<DuesBucketKey, string> = {
  "0_30": "0–30d",
  "30_45": "31–45d",
  "45_60": "46–60d",
  "60_plus": "61d+",
};
const TONE: Record<DuesBucketKey, { text: string; bg: string; ring: string }> = {
  "0_30": { text: "text-green-700", bg: "bg-green-50", ring: "border-green-500" },
  "30_45": { text: "text-amber-700", bg: "bg-amber-50", ring: "border-amber-500" },
  "45_60": { text: "text-orange-700", bg: "bg-orange-50", ring: "border-orange-500" },
  "60_plus": { text: "text-red-700", bg: "bg-red-50", ring: "border-red-500" },
};

/** Row of four ageing-bucket tabs: count + ₹ outstanding (both shimmer while the
 *  summary loads) over the fixed day-label. */
export function DuesBucketSelector({
  bucket,
  setBucket,
  loading,
  bucketCount,
  bucketOutstanding,
}: {
  readonly bucket: DuesBucketKey;
  readonly setBucket: (k: DuesBucketKey) => void;
  readonly loading: boolean;
  readonly bucketCount: (k: DuesBucketKey) => number;
  readonly bucketOutstanding: (k: DuesBucketKey) => number;
}) {
  return (
    <View className="flex-row gap-2">
      {BUCKETS.map((k) => {
        const tone = TONE[k];
        const selected = bucket === k;
        return (
          <Pressable
            key={k}
            onPress={() => setBucket(k)}
            className={`flex-1 items-center rounded-2xl border py-2.5 ${tone.bg} ${
              selected ? tone.ring : "border-transparent"
            }`}
          >
            {loading ? (
              <Skeleton width={20} height={18} radius={5} />
            ) : (
              <Text className={`text-lg font-extrabold ${tone.text}`}>{bucketCount(k)}</Text>
            )}
            {loading ? (
              <Skeleton width={34} height={11} radius={4} style={{ marginTop: 5 }} />
            ) : (
              <Text className="text-[10px] font-semibold text-foreground">
                {compactInr(bucketOutstanding(k))}
              </Text>
            )}
            <Text className="mt-0.5 text-[11px] font-medium text-muted-foreground">{SHORT[k]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
