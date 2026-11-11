import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Skeleton, SkeletonTheme } from "../skeleton";
import { Icon } from "../icon";
import { KpiDrillRow } from "./kpi-drill-row";
import {
  fetchMetricAgents,
  METRIC_META,
  type AgentRow,
  type MetricKey,
} from "../../lib/admin-drill";

/** Tap a KPI card → this dialog lists each executive's contribution to that
 *  metric (level-1 drill) for the dashboard's current date range. */
export function KpiDrillDialog({
  metric,
  range,
  onClose,
}: {
  readonly metric: MetricKey | null;
  readonly range: { from: string; to: string };
  readonly onClose: () => void;
}) {
  const [rows, setRows] = useState<AgentRow[] | null>(null);

  useEffect(() => {
    if (!metric) return;
    let cancelled = false;
    setRows(null);
    void fetchMetricAgents(metric, range.from, range.to)
      .then((r) => !cancelled && setRows(r))
      .catch(() => !cancelled && setRows([]));
    return () => {
      cancelled = true;
    };
  }, [metric, range.from, range.to]);

  if (!metric) return null;
  const meta = METRIC_META[metric];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        className="flex-1 items-center justify-center bg-black/40 px-5"
        onPress={onClose}
      >
        <Pressable
          className="max-h-[80%] w-full rounded-3xl bg-card px-5 pb-6 pt-5"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="mb-3 flex-row items-start justify-between">
            <View className="flex-1 pr-2">
              <Text className="text-lg font-bold text-card-foreground">{meta.title}</Text>
              <Text className="mt-0.5 text-xs text-muted-foreground">By executive</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              className="-mr-1 -mt-1 rounded-full p-1 active:bg-secondary"
            >
              <Icon name="close" size={20} color="#9ca3af" />
            </Pressable>
          </View>

          {(() => { if (rows === null) return (
            <SkeletonTheme>
              <View className="overflow-hidden rounded-xl border border-border">
                {[0, 1, 2, 3].map((i) => (
                  <View
                    key={i}
                    className={`flex-row items-center justify-between px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
                  >
                    <Skeleton width="45%" height={14} />
                    <Skeleton width={48} height={14} />
                  </View>
                ))}
              </View>
            </SkeletonTheme>
          ); if (rows.length === 0) return (
            <Text className="py-10 text-center text-sm text-muted-foreground">
              No activity for this metric in the selected range.
            </Text>
          ); return (
            // flexShrink lets the list grow to fit all executives, then scroll
            // once the card hits its 80% cap (RN needs a bounded, shrinkable
            // child here — a percentage max-height on this indefinite-height
            // parent silently clips instead of scrolling).
            <ScrollView style={{ flexShrink: 1 }}>
              <View className="overflow-hidden rounded-xl border border-border">
                {rows.map((r, i) => (
                  <KpiDrillRow key={r.agentId} metric={metric} row={r} first={i === 0} />
                ))}
              </View>
            </ScrollView>
          ); })()}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
