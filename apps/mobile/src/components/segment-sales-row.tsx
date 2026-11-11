import { Pressable, Text, View } from "react-native";
import { SEGMENTS, type RankedSegmentRow } from "../lib/segment-sales";

const RANK_BG: Record<number, string> = { 1: "bg-amber-100", 2: "bg-slate-100", 3: "bg-orange-100" };
const RANK_FG: Record<number, string> = { 1: "text-amber-700", 2: "text-slate-600", 3: "text-orange-700" };

/** Fixed per-segment colours (shared by the stacked bar + the breakdown dots). */
export const SEGMENT_COLOR: Record<string, string> = {
  Car: "#2563eb",
  "2W": "#0d9488",
  "3W": "#7c3aed",
  Commercial: "#d97706",
  Agri: "#16a34a",
  "Gear Oil": "#e11d48",
};

const litresLabel = (n: number): string => `${Number.isInteger(n) ? n : n.toFixed(1)} L`;

function RankBadge({ rank }: { readonly rank: number }) {
  const bg = RANK_BG[rank] ?? "bg-secondary";
  const fg = RANK_FG[rank] ?? "text-muted-foreground";
  return (
    <View className={`h-6 w-6 items-center justify-center rounded-full ${bg}`}>
      <Text className={`text-[11px] font-bold ${fg}`}>{rank}</Text>
    </View>
  );
}

export function SegmentRow({
  row,
  first,
  expanded,
  onToggle,
}: {
  readonly row: RankedSegmentRow;
  readonly first: boolean;
  readonly expanded: boolean;
  readonly onToggle: () => void;
}) {
  const breakdown = SEGMENTS.map((seg) => ({ seg, litres: row.bySegment[seg] || 0 })).sort(
    (a, b) => b.litres - a.litres,
  );
  return (
    <Pressable onPress={onToggle} className={`py-2.5 ${first ? "" : "border-t border-border"}`}>
      <View className="flex-row items-center gap-2.5">
        <RankBadge rank={row.rank} />
        <Text className="flex-1 text-sm font-semibold text-card-foreground" numberOfLines={1}>
          {row.name}
        </Text>
        <Text className="text-sm font-bold text-card-foreground">{litresLabel(row.total)}</Text>
        <Text className="w-3 text-center text-[11px] text-muted-foreground">
          {expanded ? "▾" : "▸"}
        </Text>
      </View>

      {/* Stacked segment bar (fixed segment order) */}
      <View className="ml-8 mt-2 h-1.5 flex-row overflow-hidden rounded-full bg-secondary">
        {SEGMENTS.map((seg) => {
          const pct = row.total > 0 ? ((row.bySegment[seg] || 0) / row.total) * 100 : 0;
          return pct > 0 ? (
            <View key={seg} style={{ width: `${pct}%`, backgroundColor: SEGMENT_COLOR[seg] }} />
          ) : null;
        })}
      </View>

      {expanded ? (
        <View className="ml-8 mt-3 gap-2">
          {breakdown.map(({ seg, litres }) => {
            const pct = row.total > 0 ? (litres / row.total) * 100 : 0;
            return (
              <View key={seg} className="flex-row items-center gap-2.5">
                <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: SEGMENT_COLOR[seg] }} />
                <Text className="w-20 text-xs text-card-foreground">{seg}</Text>
                <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                  <View style={{ width: `${pct}%`, height: "100%", backgroundColor: SEGMENT_COLOR[seg] }} />
                </View>
                <Text className="w-14 text-right text-[11px] font-semibold text-card-foreground">
                  {litresLabel(litres)}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </Pressable>
  );
}
