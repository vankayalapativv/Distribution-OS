import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { useDialog } from "../components/dialog";
import {
  clearAllNotifications,
  deleteNotification,
  fetchNotifications,
  markNotificationRead,
  type InvoiceNotification,
} from "./invoice-notifications";

/** State + handlers for the Super Admin Alerts feed (load, refresh, open, delete,
 *  clear-all). Kept out of the screen so the route file stays a thin view. */
export function useAdminAlerts() {
  const [items, setItems] = useState<InvoiceNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const dialog = useDialog();

  const load = useCallback(async () => {
    try {
      setItems(await fetchNotifications());
    } catch {
      // keep whatever we have
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const onOpen = useCallback((n: InvoiceNotification) => {
    if (!n.readAt) {
      setItems((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)),
      );
      void markNotificationRead(n.id);
    }
    if (n.customerId) {
      router.push({ pathname: "/customer/[id]", params: { id: n.customerId } });
    }
  }, []);

  // Delete one alert (optimistic — drop it, then hit the server).
  const onDelete = useCallback((id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
    void deleteNotification(id);
  }, []);

  // Clear the whole feed, behind a confirm (it's permanent). Uses the in-app
  // themed dialog instead of the OS Alert.alert.
  const onClearAll = useCallback(async () => {
    const ok = await dialog.confirm({
      title: "Clear all alerts?",
      message: "This permanently removes every alert in the feed.",
      confirmLabel: "Clear all",
      cancelLabel: "Cancel",
      destructive: true,
    });
    if (!ok) return;
    setItems([]);
    void clearAllNotifications();
  }, [dialog]);

  return { items, loading, refreshing, onRefresh, onOpen, onDelete, onClearAll };
}
