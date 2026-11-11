import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useDialog } from "../components/dialog";
import { useAuth } from "./auth";
import { getLocalDb } from "./db";
import { getActiveDeliveryRun } from "./sync-core";

/**
 * State + handlers for the logistics Settings screen: the active-run guard and
 * the logout flow.
 */
export function useLogisticsSettings() {
  const { user, logout } = useAuth();
  const dialog = useDialog();
  // A run is "active" once Start Deliveries is tapped and before End Deliveries.
  // Logout is blocked while one is active — the driver must end the run first.
  const [hasActiveRun, setHasActiveRun] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const db = getLocalDb();
      setHasActiveRun(db ? getActiveDeliveryRun(db) !== null : false);
    }, []),
  );

  async function onLogout() {
    // Hard block: an active delivery run must be ended before logging out, so a
    // driver can't sign out mid-run and strand the day's deliveries.
    if (hasActiveRun) {
      await dialog.alert({
        title: "End your deliveries first",
        message:
          "You have deliveries in progress. Tap “End Deliveries” on the Delivery screen to finish your run, then you can log out.",
      });
      return;
    }
    const ok = await dialog.confirm({
      title: "Log out?",
      message: "You'll need to sign in again to record deliveries.",
      confirmLabel: "Log out",
      cancelLabel: "Cancel",
      destructive: true,
    });
    if (ok) void logout();
  }

  return { user, hasActiveRun, onLogout };
}
