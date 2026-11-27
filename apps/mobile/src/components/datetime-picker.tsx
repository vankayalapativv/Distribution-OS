import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { MonthCalendar } from "./calendar-range";
import { Stepper } from "./datetime-stepper";
import { assemble, FAR_FUTURE, to12h, toYmd } from "./datetime-picker-utils";

/** In-app follow-up reminder picker — a themed date + time chooser (no native OS
 *  picker) matching the app's card/typography. Reuses MonthCalendar for the day,
 *  a flat hour/minute/AM-PM stepper for the time. */

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
