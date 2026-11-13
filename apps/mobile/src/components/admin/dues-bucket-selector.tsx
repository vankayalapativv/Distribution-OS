import { Pressable, Text, View } from "react-native";
import { Skeleton } from "../skeleton";
import { compactInr } from "../../lib/format";
import type { DuesBucketKey, DuesBucketSummary } from "../../lib/dues";

/** Severity gradient (newest → oldest debt). The band count is server-driven, so
 *  the colour grades by POSITION across however many bands the enterprise defines
 *  (same approach as the Home dues strip). */
const TONES = [
  { text: "text-green-700", bg: "bg-green-50", ring: "border-green-500" },
  { text: "text-amber-700", bg: "bg-amber-50", ring: "border-amber-500" },
  { text: "text-orange-700", bg: "bg-orange-50", ring: "border-orange-500" },
  { text: "text-red-700", bg: "bg-red-50", ring: "border-red-500" },
];
function toneForPosition(index: number, total: number): (typeof TONES)[number] {
  if (total <= 1) return TONES[TONES.length - 1];
  const stop = Math.round((index / (total - 1)) * (TONES.length - 1));
  return TONES[stop] ?? TONES[0];
}

// Placeholder cells for the initial load, before the band count is known.
const SKELETON_CELLS = [null, null, null, null];

/** Row of ageing-band tabs: count + ₹ outstanding over the band's own label. The
 *  bands come straight from the summary (SERVER-DRIVEN) — never a hardcoded set of
 *  keys/labels, which no longer match the API. */
export function DuesBucketSelector({
  buckets,
  bucket,
  setBucket,
  loading,
}: {
  readonly buckets: DuesBucketSummary[];
  readonly bucket: DuesBucketKey;
  readonly setBucket: (k: DuesBucketKey) => void;
  readonly loading: boolean;
}) {
  const cells: (DuesBucketSummary | null)[] = buckets.length > 0 ? buckets : SKELETON_CELLS;
  return (
    <View className="flex-row gap-2">
      {cells.map((b, i) => {
        const tone = toneForPosition(i, cells.length);
        const selected = b != null && bucket === b.key;
        const showSkeleton = b == null || loading;
        return (
          <Pressable
            key={b?.key ?? i}
            onPress={b ? () => setBucket(b.key) : undefined}
            className={`flex-1 items-center rounded-2xl border py-2.5 ${tone.bg} ${
              selected ? tone.ring : "border-transparent"
            }`}
          >
            {showSkeleton ? (
              <Skeleton width={20} height={18} radius={5} />
            ) : (
              <Text className={`text-lg font-extrabold ${tone.text}`}>{b.customers}</Text>
            )}
            {showSkeleton ? (
              <Skeleton width={34} height={11} radius={4} style={{ marginTop: 5 }} />
            ) : (
              <Text className="text-[10px] font-semibold text-foreground">
                {compactInr(b.outstanding)}
              </Text>
            )}
            {b == null ? (
              <Skeleton width={30} height={10} radius={4} style={{ marginTop: 5 }} />
            ) : (
              <Text className="mt-0.5 text-center text-[11px] font-medium text-muted-foreground">
                {b.label}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
