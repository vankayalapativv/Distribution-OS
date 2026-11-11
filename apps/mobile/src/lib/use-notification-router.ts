import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";

/**
 * Route a TAPPED notification to the right screen: a reminder opens the linked
 * customer (or just the app), an assigned-task push opens Reminders, and an
 * invoice push opens the Alerts feed.
 */
export function useNotificationRouter(): void {
  const router = useRouter();
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        kind?: string;
        type?: string;
        customerId?: string | null;
      };
      if (data?.kind === "reminder" && data.customerId) {
        router.push({ pathname: "/customer/[id]", params: { id: data.customerId } });
      } else if (data?.kind === "assigned_task" || data?.type === "task_assigned") {
        // Both the scheduled alarm and the "assigned" push land in Reminders.
        router.push("/reminders");
      } else if (data?.type === "invoice") {
        router.push("/alerts");
      }
    });
    return () => sub.remove();
  }, [router]);
}
