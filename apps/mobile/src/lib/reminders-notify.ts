import * as Notifications from "expo-notifications";

const CHANNEL_ID = "reminders";

/** Foreground behavior: show the banner even while the app is open. */
export function installNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Channel must exist before permission request (Android 13 flow). */
async function ensureChannel(): Promise<void> {
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Reminders",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
  }).catch(() => undefined);
}

/** True when the user allows notifications (asks on first use). */
export async function ensureNotificationPermission(): Promise<boolean> {
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync().catch(() => null);
  if (current?.granted) return true;
  const asked = await Notifications.requestPermissionsAsync().catch(() => null);
  return Boolean(asked?.granted);
}

export interface ReminderInput {
  title: string;
  remindAt: Date;
  customerId?: string | null;
  customerName?: string | null;
}

/** Schedule the OS alarm for a reminder; returns its notification id. */
export async function scheduleReminderNotification(input: ReminderInput): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: "Reminder",
      body: input.customerName ? `${input.title} — ${input.customerName}` : input.title,
      data: { kind: "reminder", customerId: input.customerId ?? null },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: input.remindAt,
      channelId: CHANNEL_ID,
    },
  });
}
