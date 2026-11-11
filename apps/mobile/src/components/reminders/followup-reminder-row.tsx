import { Text, View } from "react-native";
import type { FollowupReminder } from "../../lib/customer/followups";
import { formatWhen } from "../../lib/reminders-format";
import { RowAction } from "./row-action";

/** A customer follow-up (with a reminder time) in the Reminders tab. Overdue =
 *  the picked time has passed. "Done" resolves the follow-up (local + server). */
export function FollowupReminderRow({
  f,
  now,
  onDone,
}: {
  readonly f: FollowupReminder;
  readonly now: number;
  readonly onDone: (f: FollowupReminder) => void;
}) {
  const at = Date.parse(f.followUpAt);
  const isOverdue = at <= now;
  return (
    <View
      className={`gap-3 rounded-3xl border px-4 py-3 ${
        isOverdue ? "border-red-200 bg-red-50" : "border-border bg-card"
      }`}
    >
      <View>
        {isOverdue ? (
          <Text className="mb-1 text-[11px] font-bold uppercase tracking-wider text-red-600">
            Due now
          </Text>
        ) : null}
        <Text className="text-sm font-medium text-card-foreground">{f.customerName}</Text>
        <Text className="mt-0.5 text-sm italic text-muted-foreground">“{f.reason}”</Text>
        <Text className={`mt-0.5 text-xs ${isOverdue ? "text-red-600" : "text-muted-foreground"}`}>
          {formatWhen(at)}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        <RowAction
          icon="checkmark-circle-outline"
          label="Done"
          tone="primary"
          onPress={() => onDone(f)}
        />
      </View>
    </View>
  );
}
