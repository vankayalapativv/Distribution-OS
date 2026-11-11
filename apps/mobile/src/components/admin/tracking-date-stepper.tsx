import { Pressable, Text, View } from "react-native";
import { istToday } from "../../lib/admin-tracking";

function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Compact prev/next day stepper (shows "Today" or the date). Right-aligned in
 *  the Tracking header; can't step past today. */
export function TrackingDateStepper({
  date,
  setDate,
}: {
  readonly date: string;
  readonly setDate: (fn: (d: string) => string) => void;
}) {
  const atToday = date >= istToday();
  return (
    <View className="flex-row items-center gap-3">
      <Pressable onPress={() => setDate((d) => addDays(d, -1))} hitSlop={8}>
        <Text className="text-lg text-muted-foreground">‹</Text>
      </Pressable>
      <Text className="min-w-[64px] text-center text-sm font-medium text-foreground">
        {date === istToday() ? "Today" : date}
      </Text>
      <Pressable onPress={() => setDate((d) => (d < istToday() ? addDays(d, 1) : d))} hitSlop={8}>
        <Text className={`text-lg ${atToday ? "text-muted-foreground/30" : "text-muted-foreground"}`}>›</Text>
      </Pressable>
    </View>
  );
}
