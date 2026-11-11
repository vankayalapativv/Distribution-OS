import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDialog } from "../components/dialog";
import { useAuth } from "./auth";
import { getLocalDb } from "./db";
import { deleteReminder, listReminders, markReminderDone, type Reminder } from "./reminders";
import {
  listAssignedTasks,
  markAssignedTaskDone,
  type AssignedTask,
} from "./assigned-tasks";
import {
  type FollowupReminder,
  listFollowupReminders,
  resolveFollowup,
} from "./customer/followups";
import { kickSync, refreshAssignedTasksNow } from "./sync";
import { usePullRefresh } from "./use-pull-refresh";

/** State, focus refresh, pull-to-refresh, and row actions for the Reminders screen. */
export function useRemindersScreen() {
  const dialog = useDialog();
  const token = useAuth((s) => s.token);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [assigned, setAssigned] = useState<AssignedTask[]>([]);
  const [followups, setFollowups] = useState<FollowupReminder[]>([]);
  // "Now" for overdue/upcoming classification — a render-stable value refreshed
  // on each load (focus / pull-to-refresh / row action), not read during render.
  const [now, setNow] = useState(() => Date.now());

  // refresh() runs after async work (focus refetch, pull-to-refresh, row actions),
  // so guard its setState against the screen having unmounted meanwhile.
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const refresh = useCallback(() => {
    const db = getLocalDb();
    if (!db || !mounted.current) return;
    setReminders(listReminders(db));
    setAssigned(listAssignedTasks(db));
    setFollowups(listFollowupReminders(db));
    setNow(Date.now());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      // Pull the latest office-assigned tasks in the background, then re-read.
      void refreshAssignedTasksNow().then(refresh);
    }, [refresh]),
  );

  const { refreshing, onRefresh } = usePullRefresh(async () => {
    await refreshAssignedTasksNow();
    await kickSync();
    refresh();
  });

  async function onDone(r: Reminder) {
    const db = getLocalDb();
    if (!db) return;
    await markReminderDone(db, r);
    refresh();
  }

  function confirmDoneAssigned(t: AssignedTask) {
    void dialog
      .confirm({
        title: "Mark task done?",
        message: t.title,
        confirmLabel: "Mark done",
      })
      .then(async (ok) => {
        if (!ok) return;
        const db = getLocalDb();
        if (!db) return;
        try {
          await markAssignedTaskDone(db, t, token);
          refresh();
        } catch {
          await dialog.alert({
            title: "Couldn't mark done",
            message: "Check your connection and try again.",
          });
        }
      });
  }

  async function remove(r: Reminder) {
    const db = getLocalDb();
    if (!db) return;
    await deleteReminder(db, r);
    refresh();
  }

  function confirmDelete(r: Reminder) {
    void dialog
      .confirm({
        title: "Delete reminder?",
        message: r.title,
        confirmLabel: "Delete",
        destructive: true,
      })
      .then((ok) => {
        if (ok) void remove(r);
      });
  }

  function confirmDoneFollowup(f: FollowupReminder) {
    void dialog
      .confirm({
        title: "Mark follow-up done?",
        message: `${f.customerName} — "${f.reason}"`,
        confirmLabel: "Mark done",
      })
      .then((ok) => {
        const db = getLocalDb();
        if (!ok || !db) return;
        resolveFollowup(db, f.customerId, token);
        refresh();
      });
  }

  return {
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
  };
}
