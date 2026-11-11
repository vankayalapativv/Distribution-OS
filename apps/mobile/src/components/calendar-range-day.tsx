import { Pressable, Text, View } from "react-native";
import { toYmd } from "./calendar-range-utils";

function dayTextClass(isEndpoint: boolean, disabled: boolean): string {
  if (isEndpoint) return "font-bold text-primary-foreground";
  return disabled ? "text-muted-foreground/40" : "text-foreground";
}

/** One day cell in the range grid (or a blank filler when `day` is null).
 *  Days after `maxDate` are disabled; endpoints and the span between them
 *  are highlighted. All comparisons are string-safe on yyyy-mm-dd. */
export function DayCell({
  day,
  y,
  m,
  from,
  to,
  maxDate,
  onSelectDay,
}: {
  readonly day: number | null;
  readonly y: number;
  readonly m: number;
  readonly from: string | null;
  readonly to: string | null;
  readonly maxDate: string;
  readonly onSelectDay: (day: string) => void;
}) {
  if (day == null) return <View className="h-11 flex-1" />;
  const ymd = toYmd(y, m, day);
  const disabled = ymd > maxDate;
  const isStart = from != null && ymd === from;
  const isEnd = to != null && ymd === to;
  const isEndpoint = isStart || isEnd;
  const inRange = from != null && to != null && ymd > from && ymd < to;
  // Light blue track behind the range + its endpoints, rounded at the
  // ends so the span reads as one connected band.
  const leftRound = isStart ? "rounded-l-full" : "";
  const rightRound = isEnd ? "rounded-r-full" : "";
  const track = inRange || (isEndpoint && from !== to) ? `bg-blue-100 ${leftRound} ${rightRound}` : "";
  return (
    <View className={`h-11 flex-1 items-center justify-center ${track}`}>
      <Pressable
        disabled={disabled}
        onPress={() => onSelectDay(ymd)}
        className={`h-9 w-9 items-center justify-center rounded-full ${isEndpoint ? "bg-primary" : ""}`}
      >
        <Text
          className={`text-sm ${dayTextClass(isEndpoint, disabled)}`}
        >
          {day}
        </Text>
      </Pressable>
    </View>
  );
}
