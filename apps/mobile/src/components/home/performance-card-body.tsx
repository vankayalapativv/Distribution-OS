import { Text, View } from "react-native";
import {
  OIL_SEGMENTS,
  segLitres,
  sumLitres,
  type MyPerformance,
  type SegmentLitres,
} from "../../lib/performance";
import { collectionsForTab } from "../../lib/performance-format";
import { LeadStat, litresLabel, pctOf, rupeesLabel, SegmentRow } from "./performance-card-parts";

type Tab = "today" | "week" | "month";

/** The data region of the performance card: two lead stats, the per-segment oil
 *  breakdown, and the "no target set" note. Derives everything from `perf`/`tab`. */
export function PerformanceCardBody({ perf, tab }: Readonly<{ perf: MyPerformance; tab: Tab }>) {
  const isToday = tab === "today";
  const oilActual: SegmentLitres[] = (isToday ? perf.today.oilActual : perf[tab].oilActual) ?? [];
  const oilTarget = isToday ? null : (perf[tab].oilTarget ?? null);

  const oilTotal = sumLitres(oilActual);
  const oilTotalTarget = oilTarget ? sumLitres(oilTarget) : null;
  const hasTarget = !isToday && oilTarget !== null;
  const collected = collectionsForTab(perf, tab);

  return (
    <>
      {/* Lead stats — Oil sold · Collected. Collected is actuals-only. */}
      <View className="mb-4 flex-row gap-2">
        <LeadStat
          label="Oil sold"
          value={litresLabel(oilTotal)}
          targetText={oilTotalTarget ? `of ${litresLabel(oilTotalTarget)} target` : null}
          pct={pctOf(oilTotal, oilTotalTarget)}
        />
        <LeadStat
          label="Collected"
          value={rupeesLabel(collected.total)}
          targetText={collected.verified > 0 ? `${rupeesLabel(collected.verified)} verified` : null}
          pct={null}
        />
      </View>

      {/* Per-segment oil breakdown */}
      <Text className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Oil litres by segment
      </Text>
      <View className="gap-2.5">
        {OIL_SEGMENTS.map((segment) => (
          <SegmentRow
            key={segment}
            name={segment}
            actual={segLitres(oilActual, segment)}
            target={isToday ? null : segLitres(oilTarget, segment)}
          />
        ))}
      </View>

      {!isToday && !hasTarget ? (
        <Text className="mt-3 text-center text-xs text-muted-foreground">
          No {tab === "week" ? "weekly" : "monthly"} target set yet.
        </Text>
      ) : null}
    </>
  );
}
