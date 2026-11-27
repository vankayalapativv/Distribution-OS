import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDialog } from "../components/dialog";
import { useAuth } from "./auth";
import { getLocalDb } from "./db";
import { listReminders, type Reminder } from "./reminders";
import { listAssignedTasks, type AssignedTask } from "./assigned-tasks";
import { type FollowupReminder, listFollowupReminders } from "./customer/followups";
import { kickSync, refreshAssignedTasksNow } from "./sync";
import { buildReminderActions } from "./reminders-actions";
import { usePullRefresh } from "./use-pull-refresh";

/** State, focus refresh, pull-to-refresh, and row actions for the Reminders screen. */
export function useRemindersScreen() {
  const dialog = useDialog();
  const token = useAuth((s) => s.token);
  // Reminders are local-first: read from SQLite synchronously. Seed from the DB at
  // mount so a device with data shows it instantly (no shimmer flash); only when
  // the DB isn't open yet do we start in a loading state and shimmer until it is.
  const [reminders, setReminders] = useState<Reminder[]>(() => (getLocalDb() ? listReminders(getLocalDb()!) : []));
  const [assigned, setAssigned] = useState<AssignedTask[]>(() => (getLocalDb() ? listAssignedTasks(getLocalDb()!) : []));
  const [followups, setFollowups] = useState<FollowupReminder[]>(() => (getLocalDb() ? listFollowupReminders(getLocalDb()!) : []));
  const [loaded, setLoaded] = useState(() => getLocalDb() != null);
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
    setLoaded(true);
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

  const actions = buildReminderActions(refresh, token, dialog);

  return { reminders, assigned, followups, now, loading: !loaded, refreshing, onRefresh, ...actions };
}
