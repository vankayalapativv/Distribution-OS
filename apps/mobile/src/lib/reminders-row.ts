export interface Reminder {
  id: number;
  title: string;
  remindAt: number; // epoch ms
  customerId: string | null;
  customerName: string | null;
  notificationId: string | null;
  status: "pending" | "done";
  createdAt: number;
}

export function rowToReminder(r: Record<string, unknown>): Reminder {
  return {
    id: r.id as number,
    title: r.title as string,
    remindAt: r.remind_at as number,
    customerId: (r.customer_id as string | null) ?? null,
    customerName: (r.customer_name as string | null) ?? null,
    notificationId: (r.notification_id as string | null) ?? null,
    status: (r.status as "pending" | "done") ?? "pending",
    createdAt: r.created_at as number,
  };
}
