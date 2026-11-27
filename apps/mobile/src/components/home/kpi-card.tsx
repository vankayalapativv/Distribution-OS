import { Pressable, Text, View } from "react-native";
import { Icon, type IconName } from "../icon";
import { Skeleton } from "../skeleton";

/** Per-metric accent: a tinted icon badge that gives each card its identity. */
export type Accent = { icon: IconName; fg: string; badge: string };

/**
 * One KPI tile. The chrome — tinted icon badge, label, and any purely-static
 * subline ("live now") — renders immediately. Only server data shimmers: the
 * big value (undefined until metrics load) and count-bearing sublines
 * ("8 orders") flagged with `subDynamic`.
 */
export function KpiCard({
  label,
  value,
  sub,
  subDynamic = false,
  accent,
  onPress,
}: {
  readonly label: string;
  readonly value?: string; // undefined while metrics load → the value shimmers
  readonly sub?: string; // static sublines always set; dynamic ones only once loaded
  readonly subDynamic?: boolean; // a count-bearing subline → shimmer while loading
  readonly accent: Accent;
  readonly onPress?: () => void; // tap → open this KPI's drill-down (omit while loading)
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="flex-1 rounded-3xl border border-border bg-card p-4 active:opacity-70"
    >
      <View className="mb-2.5 flex-row items-center justify-between">
        <Text className="flex-1 pr-1 text-xs font-medium text-muted-foreground">{label}</Text>
        <View className={`h-8 w-8 items-center justify-center rounded-full ${accent.badge}`}>
          <Icon name={accent.icon} size={16} color={accent.fg} />
        </View>
      </View>
      {value === undefined ? (
        <Skeleton width={72} height={24} style={{ marginVertical: 4 }} />
      ) : (
        <Text className="text-2xl font-bold text-card-foreground">{value}</Text>
      )}
      {(() => { if (subDynamic && sub === undefined) return (
        <Skeleton width={56} height={11} style={{ marginTop: 6, marginBottom: 2 }} />
      ); if (sub) return (
        <Text className="mt-0.5 text-xs text-muted-foreground">{sub}</Text>
      ); return null; })()}
    </Pressable>
  );
}
