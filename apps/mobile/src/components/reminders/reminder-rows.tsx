import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { type Reminder } from "../../lib/reminders";
import { formatWhen } from "../../lib/reminders-format";
import { Icon } from "../icon";
import { RowAction } from "./row-action";

/** A personal-reminder row (pending / overdue). Hoisted for the same reason as
 *  AssignedRow; Edit navigates directly, Done/Delete come in as props. */
export function PendingRow({
  r,
  isOverdue,
  onDone,
  onDelete,
}: {
  readonly r: Reminder;
  readonly isOverdue: boolean;
  readonly onDone: (r: Reminder) => void;
  readonly onDelete: (r: Reminder) => void;
}) {
  return (
    <View
      className={`gap-3 rounded-3xl border px-4 py-3 ${
        isOverdue ? "border-red-200 bg-red-50" : "border-border bg-card"
      }`}
    >
      <View>
        {isOverdue ? (
          <Text className="mb-1 text-[11px] font-bold uppercase tracking-wider text-red-600">
            Overdue
          </Text>
        ) : null}
        <Text className="text-sm font-medium text-card-foreground">{r.title}</Text>
        <Text className={`mt-0.5 text-xs ${isOverdue ? "text-red-600" : "text-muted-foreground"}`}>
          {formatWhen(r.remindAt)}
          {r.customerName ? ` · ${r.customerName}` : ""}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        <RowAction icon="checkmark-circle-outline" label="Done" tone="primary" onPress={() => onDone(r)} />
        <RowAction
          icon="create-outline"
          label="Edit"
          onPress={() => router.push({ pathname: "/reminder/new", params: { id: String(r.id) } })}
        />
        <RowAction icon="trash-outline" label="Delete" tone="danger" onPress={() => onDelete(r)} />
      </View>
    </View>
  );
}

/** A completed reminder — struck through, dimmed, delete-only. */
export function DoneRow({ r, onDelete }: { readonly r: Reminder; readonly onDelete: (r: Reminder) => void }) {
  return (
    <View className="flex-row items-center gap-3 rounded-3xl border border-border bg-card px-4 py-3 opacity-60">
      <View className="flex-1">
        <Text className="text-sm font-medium text-card-foreground line-through">{r.title}</Text>
        <Text className="mt-0.5 text-xs text-muted-foreground">
          {formatWhen(r.remindAt)}
          {r.customerName ? ` · ${r.customerName}` : ""}
        </Text>
      </View>
      <Pressable hitSlop={8} onPress={() => onDelete(r)}>
        <Icon name="trash-outline" size={18} color="#9ca3af" />
      </Pressable>
    </View>
  );
}
