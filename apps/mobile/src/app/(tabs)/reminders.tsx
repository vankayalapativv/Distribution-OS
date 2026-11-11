import { router } from "expo-router";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AssignedRow } from "../../components/reminders/assigned-row";
import { DoneRow, PendingRow } from "../../components/reminders/reminder-rows";
import { FollowupReminderRow } from "../../components/reminders/followup-reminder-row";
import { Icon } from "../../components/icon";
import { useRemindersScreen } from "../../lib/use-reminders-screen";

export default function RemindersScreen() {
  const {
    reminders,
    assigned,
    followups,
    now,
    refreshing,
    onRefresh,
    onDone,
    confirmDoneAssigned,
    confirmDelete,
    confirmDoneFollowup,
  } = useRemindersScreen();

  const overdue = reminders.filter((r) => r.status === "pending" && r.remindAt <= now);
  const upcoming = reminders.filter((r) => r.status === "pending" && r.remindAt > now);
  const done = reminders.filter((r) => r.status === "done");

  return (
    <SafeAreaView className="flex-1 bg-secondary" edges={["top"]}>
      <View className="flex-row items-center justify-between px-5 py-4">
        <Text className="text-xl font-bold text-foreground">Reminders</Text>
        <Pressable
          className="rounded-full bg-primary px-4 py-2"
          onPress={() => router.push("/reminder/new")}
        >
          <Text className="text-sm font-semibold text-primary-foreground">＋ New</Text>
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-2 px-4 pb-6"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {reminders.length === 0 && assigned.length === 0 && followups.length === 0 ? (
          <View className="items-center gap-2 py-16">
            <Icon name="alarm-outline" size={44} color="#9ca3af" />
            <Text className="text-base font-semibold text-foreground">No reminders yet</Text>
            <Text className="px-8 text-center text-sm text-muted-foreground">
              Set a reminder and your phone will ring at that exact time — even when the app is
              closed.
            </Text>
          </View>
        ) : null}

        {assigned.length > 0 ? (
          <Text className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
            Assigned to you
          </Text>
        ) : null}
        {assigned.map((t) => (
          <AssignedRow key={t.id} t={t} now={now} onDone={confirmDoneAssigned} />
        ))}

        {followups.length > 0 ? (
          <Text className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            Customer follow-ups
          </Text>
        ) : null}
        {followups.map((f) => (
          <FollowupReminderRow key={f.customerId} f={f} now={now} onDone={confirmDoneFollowup} />
        ))}

        {overdue.length > 0 ? (
          <Text className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-red-600">
            Overdue
          </Text>
        ) : null}
        {overdue.map((r) => (
          <PendingRow key={r.id} r={r} isOverdue onDone={onDone} onDelete={confirmDelete} />
        ))}

        {upcoming.length > 0 ? (
          <Text className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Coming up
          </Text>
        ) : null}
        {upcoming.map((r) => (
          <PendingRow key={r.id} r={r} isOverdue={false} onDone={onDone} onDelete={confirmDelete} />
        ))}

        {done.length > 0 ? (
          <Text className="px-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Done
          </Text>
        ) : null}
        {done.map((r) => (
          <DoneRow key={r.id} r={r} onDelete={confirmDelete} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
