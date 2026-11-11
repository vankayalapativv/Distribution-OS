import { Text, View } from "react-native";
import { type AssignedTask } from "../../lib/assigned-tasks";
import { formatWhen } from "../../lib/reminders-format";
import { RowAction } from "./row-action";

/** S — Reminders: personal reminders (rings like an alarm). Closed only
 *  manually via "Done"; an elapsed-but-open reminder shows as Overdue. */
const PRIORITY_TONE: Record<string, { bg: string; text: string }> = {
  high: { bg: "bg-red-100", text: "text-red-700" },
  medium: { bg: "bg-amber-100", text: "text-amber-700" },
  low: { bg: "bg-blue-100", text: "text-blue-700" },
};

/** An office-assigned task row. Hoisted to module scope (NOT declared inside the
 *  screen) so it's a stable component type — otherwise every refresh() remounts
 *  the whole reminder list. `now` + callbacks come in as props. */
export function AssignedRow({
  t,
  now,
  onDone,
}: {
  readonly t: AssignedTask;
  readonly now: number;
  readonly onDone: (t: AssignedTask) => void;
}) {
  const overdueTask = t.remindAt <= now;
  const tone = PRIORITY_TONE[t.priority] ?? PRIORITY_TONE.medium;
  return (
    <View
      className={`gap-3 rounded-3xl border px-4 py-3 ${
        overdueTask ? "border-red-200 bg-red-50" : "border-primary/30 bg-card"
      }`}
    >
      <View className="gap-1">
        <View className="flex-row items-center gap-2">
          <View className={`rounded-full px-2 py-0.5 ${tone.bg}`}>
            <Text className={`text-[10px] font-bold uppercase ${tone.text}`}>{t.priority}</Text>
          </View>
          {overdueTask ? (
            <Text className="text-[11px] font-bold uppercase tracking-wider text-red-600">
              Overdue
            </Text>
          ) : null}
        </View>
        <Text className="text-sm font-semibold text-card-foreground">{t.title}</Text>
        {t.description ? (
          <Text className="text-xs text-muted-foreground">{t.description}</Text>
        ) : null}
        <Text className={`mt-0.5 text-xs ${overdueTask ? "text-red-600" : "text-muted-foreground"}`}>
          {formatWhen(t.remindAt)}
          {t.customerName ? ` · ${t.customerName}` : ""}
        </Text>
        {t.createdByName ? (
          <Text className="text-[11px] text-muted-foreground">Assigned by {t.createdByName}</Text>
        ) : null}
      </View>
      <View className="flex-row items-center gap-2">
        <RowAction
          icon="checkmark-circle-outline"
          label="Mark done"
          tone="primary"
          onPress={() => onDone(t)}
        />
      </View>
    </View>
  );
}
