import { router } from "expo-router";
import { useCallback, useState } from "react";
import { useDialog } from "../components/dialog";
import {
  clearAllNotifications,
  deleteNotification,
  markNotificationRead,
  type InvoiceNotification,
} from "./invoice-notifications";
import { useNotificationsCache, useNotificationsQuery } from "./notifications-query";

/** All state + handlers for the SE Alerts tab. Reads the SHARED notifications
 *  query (same cache as the tab badge) — no separate fetch — and patches that
 *  cache on read/delete so the badge stays in lockstep. Online-only. */
export function useSeAlerts() {
  const dialog = useDialog();
  const query = useNotificationsQuery();
  const { patch, refetch } = useNotificationsCache();
  const [refreshing, setRefreshing] = useState(false);

  // null only during the FIRST load (drives the skeleton); once settled, [] on a
  // first-load error rather than stuck-loading. Later refetch errors keep prior data.
  const notifications = query.isPending ? null : (query.data ?? []);

  // Called on tab focus — pull the freshest feed instead of waiting out the 60s poll.
  const reload = useCallback(() => void refetch(), [refetch]);

  // Pull-to-refresh — refetch the shared cache, keep the spinner up until it lands.
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  function markRead(n: InvoiceNotification) {
    if (n.readAt) return;
    void markNotificationRead(n.id).catch(() => undefined);
    const now = new Date().toISOString();
    patch((list) => list.map((x) => (x.id === n.id ? { ...x, readAt: now } : x)));
  }

  // Open the invoice preview screen (SE views the PDF before forwarding it).
  function onOpen(n: InvoiceNotification) {
    if (!n.invoiceId) return;
    if (!n.readAt) markRead(n);
    router.push({ pathname: "/invoice/[id]", params: { id: n.invoiceId, title: n.title } });
  }

  // Tap a dues alert → mark it read and open that customer's ledger.
  function onDues(n: InvoiceNotification) {
    markRead(n);
    if (!n.customerId) return;
    const customerName = n.title.replace(/^Dues alert:\s*/i, "").trim();
    router.push({ pathname: "/ledger/[id]", params: { id: n.customerId, customerName } });
  }

  // SE self-delete: drop it locally first (optimistic), then tell the server.
  function deleteOne(id: string) {
    patch((list) => list.filter((n) => n.id !== id));
    void deleteNotification(id);
  }

  async function clearAll() {
    if (!notifications || notifications.length === 0) return;
    const ok = await dialog.confirm({
      title: "Clear all alerts?",
      message: "This removes all your notifications. This can't be undone.",
      confirmLabel: "Clear all",
      cancelLabel: "Cancel",
      destructive: true,
    });
    if (!ok) return;
    patch(() => []);
    void clearAllNotifications();
  }

  return { notifications, reload, refreshing, onRefresh, onOpen, onDues, markRead, deleteOne, clearAll };
}
