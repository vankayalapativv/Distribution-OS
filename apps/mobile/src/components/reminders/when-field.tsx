import DateTimePicker from "@react-native-community/datetimepicker";
import { Pressable, Text, View } from "react-native";
import { Icon } from "../icon";

/** "When" — Option B: one tap opens the date picker, then chains straight to
 *  the time picker. Both merge into the existing `when` date part-by-part. */
export function WhenField({
  when,
  whenLabel,
  showDate,
  showTime,
  setShowDate,
  setShowTime,
  setWhen,
}: {
  readonly when: Date;
  readonly whenLabel: string;
  readonly showDate: boolean;
  readonly showTime: boolean;
  readonly setShowDate: (v: boolean) => void;
  readonly setShowTime: (v: boolean) => void;
  readonly setWhen: (updater: (cur: Date) => Date) => void;
}) {
  return (
    <>
      <Text className="mt-4 text-sm font-medium text-foreground">When</Text>
      <Pressable
        className="mt-1 flex-row items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3"
        onPress={() => setShowDate(true)}
      >
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-secondary">
          <Icon name="alarm-outline" size={20} color="#0f172a" />
        </View>
        <View className="flex-1">
          <Text className="text-[11px] font-medium text-muted-foreground">Reminder time</Text>
          <Text className="text-base font-bold text-foreground">{whenLabel}</Text>
        </View>
        <Text className="text-sm font-semibold text-primary">Change</Text>
      </Pressable>
      {showDate ? (
        <DateTimePicker
          value={when}
          mode="date"
          minimumDate={new Date()}
          onChange={(event, d) => {
            setShowDate(false);
            if (event.type === "dismissed") return;
            if (d)
              setWhen((cur) => {
                const next = new Date(cur);
                next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
                return next;
              });
            // Chain straight to the time picker.
            setShowTime(true);
          }}
        />
      ) : null}
      {showTime ? (
        <DateTimePicker
          value={when}
          mode="time"
          onChange={(event, d) => {
            setShowTime(false);
            if (event.type === "dismissed") return;
            if (d)
              setWhen((cur) => {
                const next = new Date(cur);
                next.setHours(d.getHours(), d.getMinutes(), 0, 0);
                return next;
              });
          }}
        />
      ) : null}
    </>
  );
}
