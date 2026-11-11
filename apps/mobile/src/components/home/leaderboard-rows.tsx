import { ScrollView, Text, View } from "react-native";
import type { RankedRow } from "../../lib/leaderboard";
import { Skeleton, SkeletonTheme } from "../skeleton";

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

// Gold / silver / bronze tints for the top-three tiles (ranks 4+ stay neutral).
const RANK_BG: Record<number, string> = {
  1: "bg-amber-100",
  2: "bg-slate-100",
  3: "bg-orange-100",
};
const RANK_BORDER: Record<number, string> = {
  1: "border-amber-300",
  2: "border-slate-300",
  3: "border-orange-300",
};

function litresLabel(n: number): string {
  return `${Number.isInteger(n) ? n : n.toFixed(1)} L`;
}

/** First-load placeholder shaped like a row of ranked tiles. */
export function LeaderboardRowsSkeleton() {
  return (
    <SkeletonTheme>
      <View className="flex-row gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            className="w-24 items-center gap-2 rounded-2xl border border-border bg-secondary px-2 py-3"
          >
            <Skeleton width={32} height={32} radius={16} />
            <Skeleton width="70%" height={12} />
            <Skeleton width="55%" height={12} />
          </View>
        ))}
      </View>
    </SkeletonTheme>
  );
}

/** Horizontal strip of ranked SE tiles; the viewer's own row is highlighted. */
export function LeaderboardRows({ ranked }: { readonly ranked: RankedRow[] }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2.5 pb-1 pr-1"
    >
      {ranked.map((r) => (
        <View
          key={r.userId}
          className={`w-24 items-center gap-1.5 rounded-2xl border px-2 py-3 ${
            RANK_BG[r.rank] ?? "bg-secondary"
          } ${r.isMe ? "border-primary" : RANK_BORDER[r.rank] ?? "border-border"}`}
        >
          <View className="h-8 items-center justify-center">
            {r.rank <= 3 ? (
              <Text className="text-2xl">{MEDAL[r.rank]}</Text>
            ) : (
              <View className="h-8 w-8 items-center justify-center rounded-full bg-card">
                <Text className="text-sm font-bold text-muted-foreground">{r.rank}</Text>
              </View>
            )}
          </View>
          <Text className="text-xs font-semibold text-card-foreground" numberOfLines={1}>
            {r.name}
          </Text>
          <Text className="text-sm font-extrabold text-card-foreground">
            {litresLabel(r.litres)}
          </Text>
          {r.isMe ? <Text className="text-[10px] font-semibold text-primary">You</Text> : null}
        </View>
      ))}
    </ScrollView>
  );
}
