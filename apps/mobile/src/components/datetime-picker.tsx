import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { Icon } from "./icon";
import { MonthCalendar } from "./calendar-range";

/** In-app follow-up reminder picker — a themed date + time chooser (no native OS
 *  picker) matching the app's card/typography. Reuses MonthCalendar for the day,
 *  a flat hour/minute/AM-PM stepper for the time. */

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
function to12h(h24: number): { h: number; ampm: "AM" | "PM" } {
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return { h, ampm };
}
function to24h(h12: number, ampm: "AM" | "PM"): number {
  if (ampm === "AM") return h12 === 12 ? 0 : h12;
  return h12 === 12 ? 12 : h12 + 12;
}
/** The chosen moment, assembled from the day + 12h time parts. */
function assemble(ymd: string, h12: number, minute: number, ampm: "AM" | "PM"): Date {
  const base = parseYmd(ymd);
  base.setHours(to24h(h12, ampm), minute, 0, 0);
  return base;
}

const FAR_FUTURE = toYmd(new Date(Date.now() + 730 * 86400000)); // ~2y, so no day is disabled

function Stepper({ value, onUp, onDown }: { readonly value: string; readonly onUp: () => void; readonly onDown: () => void }) {
  return (
    <View className="items-center">
      <Pressable onPress={onUp} hitSlop={8} className="h-8 w-12 items-center justify-center">
        <Icon name="chevron-up" size={20} color="#334155" />
      </Pressable>
      <Text className="w-14 text-center text-2xl font-bold text-foreground">{value}</Text>
      <Pressable onPress={onDown} hitSlop={8} className="h-8 w-12 items-center justify-center">
        <Icon name="chevron-down" size={20} color="#334155" />
      </Pressable>
    </View>
  );
}

export function DateTimePickerCard({
  visible,
  initial,
  title,
  message,
  onCancel,
  onConfirm,
}: {
  readonly visible: boolean;
  readonly initial: Date;
  readonly title: string;
  readonly message?: string;
  readonly onCancel: () => void;
  readonly onConfirm: (iso: string) => void;
}) {
  // State is seeded from `initial` on mount; the provider remounts this card
  // (via a changing key) on every open, so these initializers re-run fresh —
  // no re-seeding effect needed.
  const [ymd, setYmd] = useState(() => toYmd(initial));
  const [h12, setH12] = useState(() => to12h(initial.getHours()).h);
  const [minute, setMinute] = useState(() => initial.getMinutes());
  const [ampm, setAmpm] = useState<"AM" | "PM">(() => to12h(initial.getHours()).ampm);

  const chosen = assemble(ymd, h12, minute, ampm);
  const summary = chosen.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const timeLabel = `${h12}:${String(minute).padStart(2, "0")} ${ampm}`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-6" onPress={onCancel}>
        <Pressable className="w-full max-w-sm rounded-3xl bg-card p-5" onPress={() => undefined}>
          <Text className="text-center text-lg font-bold text-foreground">{title}</Text>
          {message ? (
            <Text className="mt-0.5 text-center text-sm text-muted-foreground">{message}</Text>
          ) : null}
          <Text className="mb-4 mt-1 text-center text-sm font-semibold text-primary">
            {summary} · {timeLabel}
          </Text>

          <MonthCalendar from={ymd} to={ymd} maxDate={FAR_FUTURE} onSelectDay={setYmd} />

          <Text className="mb-1 mt-4 text-xs font-semibold uppercase text-muted-foreground">Time</Text>
          <View className="flex-row items-center justify-center gap-2">
            <Stepper value={String(h12)} onUp={() => setH12((h) => (h % 12) + 1)} onDown={() => setH12((h) => (h === 1 ? 12 : h - 1))} />
            <Text className="text-2xl font-bold text-foreground">:</Text>
            <Stepper
              value={String(minute).padStart(2, "0")}
              onUp={() => setMinute((m) => (m + 5) % 60)}
              onDown={() => setMinute((m) => (m + 55) % 60)}
            />
            <View className="ml-2">
              {(["AM", "PM"] as const).map((v) => (
                <Pressable
                  key={v}
                  onPress={() => setAmpm(v)}
                  className={`mb-1 rounded-lg px-4 py-1.5 ${ampm === v ? "bg-primary" : "border border-border"}`}
                >
                  <Text className={`text-sm font-semibold ${ampm === v ? "text-primary-foreground" : "text-foreground"}`}>
                    {v}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="mt-5 flex-row gap-3">
            <Pressable onPress={onCancel} className="flex-1 items-center rounded-full border border-border py-3.5">
              <Text className="font-semibold text-foreground">Not now</Text>
            </Pressable>
            <Pressable
              onPress={() => onConfirm(chosen.toISOString())}
              className="flex-1 items-center rounded-full bg-primary py-3.5"
            >
              <Text className="font-semibold text-primary-foreground">Set reminder</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
