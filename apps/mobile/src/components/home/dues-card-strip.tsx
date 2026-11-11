import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { compactInr } from "../../lib/format";
import type { DuesBucketSummary } from "../../lib/dues";

/** Severity gradient (newest → oldest debt). Band count is server-driven, so the
 *  colour grades by POSITION across however many bands the enterprise defines. */
const TONE_STOPS = ["text-green-600", "text-amber-600", "text-orange-600", "text-red-600"];

function toneForPosition(index: number, total: number): string {
  if (total <= 1) return TONE_STOPS[TONE_STOPS.length - 1];
  const stop = Math.round((index / (total - 1)) * (TONE_STOPS.length - 1));
  return TONE_STOPS[stop] ?? "text-foreground";
}

/** The ageing strip: customer count + ₹ outstanding per band (count is
 *  server-driven). Each column taps through to that band's customer list. */
export function DuesCardStrip({ buckets }: { readonly buckets: DuesBucketSummary[] }) {
  return (
    <View className="flex-row overflow-hidden rounded-xl border border-border">
      {buckets.map((bucket, i) => (
        <Pressable
          key={bucket.key}
          onPress={() =>
            router.push({ pathname: "/dues/[bucket]", params: { bucket: bucket.key, label: bucket.label } })
          }
          className={`flex-1 items-center py-2 active:bg-secondary ${
            i < buckets.length - 1 ? "border-r border-border" : ""
          }`}
        >
          <Text className={`text-base font-extrabold ${toneForPosition(i, buckets.length)}`}>
            {bucket.customers}
          </Text>
          <Text className="mt-0.5 text-[11px] font-semibold text-card-foreground">
            {compactInr(bucket.outstanding)}
          </Text>
          <Text className="mt-0.5 text-center text-[10px] text-muted-foreground">
            {bucket.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
