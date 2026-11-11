import { router } from "expo-router";
import type { ConfirmOptions } from "../dialog";
import type { DirectoryCustomer } from "../../lib/customer-directory";
import { getLocalDb } from "../../lib/db";
import { ensureReminderDelivery } from "../../lib/permissions";
import {
  createReminder,
  ensureNotificationPermission,
  getReminderById,
  updateReminder,
} from "../../lib/reminders";

interface SaveArgs {
  editId: number | null;
  title: string;
  when: Date;
  customer: DirectoryCustomer | null;
  busy: boolean;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  setError: (message: string | null) => void;
  setBusy: (busy: boolean) => void;
}

/** Validate the form and create/update the reminder, then pop the screen. */
export async function saveReminder({
  editId,
  title,
  when,
  customer,
  busy,
  confirm,
  setError,
  setBusy,
}: SaveArgs) {
  if (busy) return;
  const db = getLocalDb();
  if (!db) return;
  if (!title.trim()) {
    setError("Write what to remind you about.");
    return;
  }
  if (!customer) {
    setError("Pick the customer this reminder is about.");
    return;
  }
  if (when.getTime() <= Date.now() + 30_000) {
    setError("Pick a time in the future.");
    return;
  }
  const allowed = await ensureNotificationPermission();
  if (!allowed) {
    setError("Allow notifications so the reminder can ring.");
    return;
  }
  // Ensure it will ring ON TIME: exact-alarm capability + battery-optimization
  // exemption. Without these Android delays the alarm (Doze / OEM battery
  // managers). Auto-skips when already granted; non-blocking otherwise.
  await ensureReminderDelivery(confirm);
  setBusy(true);
  try {
    const payload = {
      title: title.trim(),
      remindAt: when,
      customerId: customer.id,
      customerName: customer.name,
    };
    if (editId != null) {
      const existing = getReminderById(db, editId);
      if (existing) await updateReminder(db, existing, payload);
    } else {
      await createReminder(db, payload, Date.now());
    }
    router.back();
  } catch (e) {
    setError(e instanceof Error ? e.message : "Could not save the reminder.");
    setBusy(false);
  }
}
