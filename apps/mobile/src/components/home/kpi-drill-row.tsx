import { Text, View } from "react-native";
import { METRIC_META, type AgentRow, type MetricKey } from "../../lib/admin-drill";

/**
 * Productivity % → a colour on a continuous red→amber→green scale (0 = bad,
 * 100 = top): hue slides 0° (red) to 120° (green), so 50% lands on amber. Returns
 * a light tinted background + a darker same-hue text, so the pill reads at a glance.
 */
function productivityColor(pct: number): { bg: string; fg: string } {
  const hue = Math.max(0, Math.min(120, (pct / 100) * 120));
  return { bg: `hsl(${hue}, 68%, 92%)`, fg: `hsl(${hue}, 72%, 30%)` };
}

/** Value text colour by drill-row tone. */
function toneClass(tone: "live" | "muted" | undefined): string {
  if (tone === "live") return "text-green-600";
  if (tone === "muted") return "text-muted-foreground";
  return "text-card-foreground";
}

/** One executive row in a KPI drill-down: name + metric-specific value/subline.
 *  The Productivity drill also shows each SE's productive/total-visits %
 *  as a colour-graded pill beside the count. */
export function KpiDrillRow({
  metric,
  row,
  first,
}: Readonly<{
  metric: MetricKey;
  row: AgentRow;
  first: boolean;
}>) {
  const d = METRIC_META[metric].row(row);

  // productiveVisits ÷ total visits, for the Productivity drill only.
  const total = row.visits ?? 0;
  const showPct = metric === "productivity" && total > 0;
  const pct = showPct ? Math.round(((row.productiveVisits ?? 0) / total) * 100) : 0;
  const pill = showPct ? productivityColor(pct) : null;

  return (
    <View
      className={`flex-row items-center justify-between gap-3 px-4 py-3 ${first ? "" : "border-t border-border"}`}
    >
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-medium text-card-foreground" numberOfLines={1}>
          {row.agentName}
        </Text>
        {d.sub ? <Text className="mt-0.5 text-xs text-muted-foreground">{d.sub}</Text> : null}
      </View>

      <View className="shrink-0 flex-row items-center gap-2">
        {pill ? (
          <View style={{ backgroundColor: pill.bg }} className="rounded-full px-2 py-0.5">
            <Text style={{ color: pill.fg }} className="text-xs font-semibold">
              Productivity <Text className="tabular-nums">{pct}%</Text>
            </Text>
          </View>
        ) : null}
        <Text className={`text-sm font-semibold tabular-nums ${toneClass(d.tone)}`}>
          {d.value}
        </Text>
      </View>
    </View>
  );
}
