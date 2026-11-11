import { Text, View } from "react-native";

export function litresLabel(v: number): string {
  return `${v.toLocaleString("en-IN")} L`;
}
export function rupeesLabel(v: number): string {
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

/** Percent → fill colour (green on track, blue neutral, amber/red behind). */
function barColor(pct: number): string {
  if (pct >= 100) return "bg-green-600";
  if (pct >= 60) return "bg-blue-500";
  if (pct >= 30) return "bg-amber-500";
  return "bg-red-500";
}

export function pctOf(actual: number, target: number | null): number | null {
  return target && target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : null;
}

/** A headline stat (e.g. oil total). */
export function LeadStat({
  label,
  value,
  targetText,
  pct,
}: Readonly<{
  label: string;
  value: string;
  targetText: string | null;
  pct: number | null;
}>) {
  return (
    <View className="flex-1 rounded-xl border border-border bg-gray-50 px-2.5 py-2.5">
      <Text className="text-[11px] font-medium text-muted-foreground" numberOfLines={1}>
        {label}
      </Text>
      {/* text-lg (not xl) so three stats fit one row on a narrow phone;
          adjustsFontSizeToFit shrinks long values (e.g. ₹1,62,159) instead of
          truncating or wrapping mid-number. */}
      <Text
        className="mt-1 text-lg font-extrabold text-card-foreground"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value}
      </Text>
      {targetText ? (
        <Text className="mt-0.5 text-[11px] text-muted-foreground">{targetText}</Text>
      ) : null}
      {pct !== null ? (
        <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
          <View
            className={`h-full rounded-full ${barColor(pct)}`}
            style={{ width: `${Math.max(pct, 2)}%` }}
          />
        </View>
      ) : null}
    </View>
  );
}

/** One oil segment row; zero collapses to a quiet dash with no bar. */
export function SegmentRow({
  name,
  actual,
  target,
}: Readonly<{
  name: string;
  actual: number;
  target: number | null;
}>) {
  const isZero = actual === 0 && (!target || target === 0);
  const pct = pctOf(actual, target);
  let value: string;
  if (isZero) value = "—";
  else if (target && target > 0) value = `${actual} / ${target} L`;
  else value = `${actual} L`;
  return (
    <View className="flex-row items-center gap-3">
      <Text
        className={`w-[74px] text-[13px] ${
          isZero ? "text-muted-foreground" : "font-semibold text-card-foreground"
        }`}
      >
        {name}
      </Text>
      <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
        {pct !== null ? (
          <View
            className={`h-full rounded-full ${barColor(pct)}`}
            style={{ width: `${Math.max(pct, 2)}%` }}
          />
        ) : null}
      </View>
      <Text
        className={`w-[86px] text-right text-[12px] ${
          isZero ? "text-muted-foreground" : "font-bold text-card-foreground"
        }`}
      >
        {value}
      </Text>
    </View>
  );
}
