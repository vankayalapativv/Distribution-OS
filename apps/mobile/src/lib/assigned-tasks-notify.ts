import * as Notifications from "expo-notifications";

const CHANNEL_ID = "reminders"; // same alarm channel as personal reminders

export async function scheduleTaskNotification(task: {
  title: string;
  customerName: string | null;
  remindAt: number;
  customerId: string | null;
  id: string;
}): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: "Task reminder",
      body: task.customerName ? `${task.title} — ${task.customerName}` : task.title,
      data: { kind: "assigned_task", taskId: task.id, customerId: task.customerId },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(task.remindAt),
      channelId: CHANNEL_ID,
    },
  });
}

export async function cancel(notificationId: string | null): Promise<void> {
  if (!notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => undefined);
}
