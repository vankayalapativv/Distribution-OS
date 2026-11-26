import type { useDialog } from "../components/dialog";
import { getLocalDb } from "./db";
import { deleteReminder, markReminderDone, type Reminder } from "./reminders";
import { markAssignedTaskDone, type AssignedTask } from "./assigned-tasks";
import { resolveFollowup, type FollowupReminder } from "./customer/followups";

type Dialog = ReturnType<typeof useDialog>;

/** Row actions (mark done / delete, each with its confirm) for the Reminders
 *  screen, bound to the screen's `refresh`, the auth token, and the dialog. */
export function buildReminderActions(refresh: () => void, token: string | null, dialog: Dialog) {
  async function onDone(r: Reminder) {
    const db = getLocalDb();
    if (!db) return;
    await markReminderDone(db, r);
    refresh();
  }

  function confirmDoneAssigned(t: AssignedTask) {
    void dialog
      .confirm({ title: "Mark task done?", message: t.title, confirmLabel: "Mark done" })
      .then(async (ok) => {
        if (!ok) return;
        const db = getLocalDb();
        if (!db) return;
        try {
          await markAssignedTaskDone(db, t, token);
          refresh();
        } catch {
          await dialog.alert({ title: "Couldn't mark done", message: "Check your connection and try again." });
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
      .confirm({ title: "Delete reminder?", message: r.title, confirmLabel: "Delete", destructive: true })
      .then((ok) => {
        if (ok) void remove(r);
      });
  }

  function confirmDoneFollowup(f: FollowupReminder) {
    void dialog
      .confirm({ title: "Mark follow-up done?", message: `${f.customerName} — "${f.reason}"`, confirmLabel: "Mark done" })
      .then((ok) => {
        const db = getLocalDb();
        if (!ok || !db) return;
        resolveFollowup(db, f.customerId, token);
        refresh();
      });
  }

  return { onDone, confirmDoneAssigned, confirmDelete, confirmDoneFollowup };
}
