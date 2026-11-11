import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { MonthCalendar } from "./calendar-range";

/** "yyyy-mm-dd" → local Date (avoids UTC day-shift). */
function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function rangeLabel(from: string, to: string): string {
  const fmt = (s: string) =>
    parseYmd(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return from === to ? fmt(from) : `${fmt(from)} – ${fmt(to)}`;
}

/**
 * Centered from–to date range picker built on an in-app calendar (no native
 * OS picker). First tap sets the start; a later tap sets the end and the span
 * highlights. Tapping before the start, or once a full range exists, begins a
 * fresh range. Apply commits (single tap ⇒ a one-day range).
 */
export function DateRangeSheet({
  visible,
  from,
  to,
  onApply,
  onClose,
}: {
  readonly visible: boolean;
  readonly from: string;
  readonly to: string;
  readonly onApply: (from: string, to: string) => void;
  readonly onClose: () => void;
}) {
  const [f, setF] = useState<string | null>(from);
  const [t, setT] = useState<string | null>(to);
  const today = toYmd(new Date());

  // Reset local selection to the committed range each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setF(from);
      setT(to);
    }
  }, [visible, from, to]);

  const selectDay = (day: string) => {
    // No start yet, or a complete range already picked → start a fresh range.
    if (f == null || t != null) {
      setF(day);
      setT(null);
      return;
    }
    // Second tap: earlier than the start restarts; otherwise closes the range.
    if (day < f) setF(day);
    else setT(day);
  };

  const canApply = f != null;
  const summary = f != null ? rangeLabel(f, t ?? f) : "Tap a start date";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-6" onPress={onClose}>
        <Pressable className="w-full max-w-sm rounded-3xl bg-card p-5" onPress={() => undefined}>
          <Text className="text-center text-lg font-bold text-foreground">Select date range</Text>
          <Text className="mb-4 mt-0.5 text-center text-sm text-muted-foreground">{summary}</Text>

          <MonthCalendar from={f} to={t} maxDate={today} onSelectDay={selectDay} />

          <View className="mt-5 flex-row gap-3">
            <Pressable
              onPress={onClose}
              className="flex-1 items-center rounded-full border border-border py-3.5"
            >
              <Text className="font-semibold text-foreground">Cancel</Text>
            </Pressable>
            <Pressable
              disabled={!canApply}
              onPress={() => f != null && onApply(f, t ?? f)}
              className={`flex-1 items-center rounded-full py-3.5 ${canApply ? "bg-primary" : "bg-muted"}`}
            >
              <Text className={`font-semibold ${canApply ? "text-primary-foreground" : "text-muted-foreground"}`}>
                Apply
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
