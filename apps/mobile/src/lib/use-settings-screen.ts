import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useDialog } from "../components/dialog";
import { useAuth } from "./auth";
import { getLocalDb } from "./db";
import { getFailedItems, type FailedItem } from "./sync-core";
import { useSyncStore } from "./sync";

/** State, focus refresh, and actions for the Settings screen (S11). */
export function useSettingsScreen() {
  const { user, logout } = useAuth();
  const dialog = useDialog();
  const sync = useSyncStore();
  const [failedItems, setFailedItems] = useState<FailedItem[]>([]);

  const refreshSync = useSyncStore((s) => s.refreshStats);
  useFocusEffect(
    useCallback(() => {
      const db = getLocalDb();
      setFailedItems(db ? getFailedItems(db) : []);
      refreshSync();
    }, [refreshSync]),
  );

  function retryFailed() {
    useSyncStore.getState().retryFailed();
    const db = getLocalDb();
    setFailedItems(db ? getFailedItems(db) : []);
  }

  async function onLogout() {
    const ok = await dialog.confirm({
      title: "Log out?",
      message: "You'll need to sign in again to record orders and collections.",
      confirmLabel: "Log out",
      cancelLabel: "Cancel",
      destructive: true,
    });
    if (ok) void logout();
  }

  const roleLabel = (user?.role ?? "")
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return { user, onLogout, roleLabel, sync, failedItems, retryFailed };
}
