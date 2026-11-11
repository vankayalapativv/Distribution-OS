import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { compactInr } from "../../lib/format";
import type { DuesBucketSummary } from "../../lib/dues";

/** Per-bucket count colour (severity), matching the SA dues card. */
const COUNT_TONE: Record<string, string> = {
  "0_30": "text-green-600",
  "30_45": "text-amber-600",
  "45_60": "text-orange-600",
  "60_plus": "text-red-600",
};

const SHORT_LABEL: Record<string, string> = {
  "0_30": "0–30d",
  "30_45": "31–45d",
  "45_60": "46–60d",
  "60_plus": "61d+",
};

/** The 4-column ageing strip: customer count + ₹ outstanding per bucket (same as
 *  the SA dues card). Each column taps through to that bucket's customer list. */
export function DuesCardStrip({ buckets }: { readonly buckets: DuesBucketSummary[] }) {
  return (
    <View className="flex-row overflow-hidden rounded-xl border border-border">
      {buckets.map((bucket, i) => (
        <Pressable
          key={bucket.key}
          onPress={() => router.push(`/dues/${bucket.key}`)}
          className={`flex-1 items-center py-2 active:bg-secondary ${
            i < buckets.length - 1 ? "border-r border-border" : ""
          }`}
        >
          <Text className={`text-base font-extrabold ${COUNT_TONE[bucket.key] ?? "text-foreground"}`}>
            {bucket.customers}
          </Text>
          <Text className="mt-0.5 text-[11px] font-semibold text-card-foreground">
            {compactInr(bucket.outstanding)}
          </Text>
          <Text className="mt-0.5 text-[10px] text-muted-foreground">
            {SHORT_LABEL[bucket.key] ?? bucket.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
