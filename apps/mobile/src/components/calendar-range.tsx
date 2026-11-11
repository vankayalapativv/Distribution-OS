import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Icon } from "./icon";
import { DayCell } from "./calendar-range-day";
import { MONTHS, parseYmd, WEEKDAYS } from "./calendar-range-utils";

/**
 * Hand-rolled single-month range calendar (no native picker, no dependency).
 * Tap a day to set the start; tap a later day to set the end — the span between
 * highlights. Tapping again starts a fresh range. Days after `maxDate` are
 * disabled. All comparisons are string-safe on the yyyy-mm-dd format.
 */
export function MonthCalendar({
  from,
  to,
  maxDate,
  onSelectDay,
}: {
  readonly from: string | null;
  readonly to: string | null;
  readonly maxDate: string;
  readonly onSelectDay: (day: string) => void;
}) {
  const anchor = parseYmd(to || from || maxDate);
  const [view, setView] = useState({ y: anchor.getFullYear(), m: anchor.getMonth() });

  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const max = parseYmd(maxDate);
  const atMaxMonth = view.y === max.getFullYear() && view.m === max.getMonth();

  // Build a flat cell list: leading blanks + each day, padded to full weeks.
  const cells: { key: string; day: number | null }[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push({ key: `b${i}`, day: null });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ key: `d${d}`, day: d });
  while (cells.length % 7 !== 0) cells.push({ key: `t${cells.length}`, day: null });
  const weeks: { key: string; day: number | null }[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const step = (delta: number) => {
    const next = view.m + delta;
    setView({ y: view.y + Math.floor(next / 12), m: ((next % 12) + 12) % 12 });
  };

  return (
    <View>
      {/* Month header + navigation */}
      <View className="mb-3 flex-row items-center justify-between px-1">
        <Pressable onPress={() => step(-1)} hitSlop={10} className="h-9 w-9 items-center justify-center rounded-full">
          <Icon name="chevron-back" size={20} color="#334155" />
        </Pressable>
        <Text className="text-base font-bold text-foreground">
          {MONTHS[view.m]} {view.y}
        </Text>
        <Pressable
          onPress={() => step(1)}
          disabled={atMaxMonth}
          hitSlop={10}
          className="h-9 w-9 items-center justify-center rounded-full"
        >
          <Icon name="chevron-forward" size={20} color={atMaxMonth ? "#cbd5e1" : "#334155"} />
        </Pressable>
      </View>

      {/* Weekday header */}
      <View className="mb-1 flex-row">
        {WEEKDAYS.map((w) => (
          <Text key={w.key} className="flex-1 text-center text-[11px] font-semibold text-muted-foreground">
            {w.label}
          </Text>
        ))}
      </View>

      {/* Day grid */}
      {weeks.map((week) => (
        <View key={week[0].key} className="flex-row">
          {week.map((cell) => (
            <DayCell
              key={cell.key}
              day={cell.day}
              y={view.y}
              m={view.m}
              from={from}
              to={to}
              maxDate={maxDate}
              onSelectDay={onSelectDay}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
