/**
 * Expo push-token registration. Split out of invoice-notifications.ts (which
 * re-exports it) to keep each file small.
 */
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { apiFetch } from "./api";
import { useAuth } from "./auth";

// The EAS projectId that scopes this app's Expo push tokens. Read it from the app
// config (app.json → extra.eas.projectId) so it ALWAYS matches the project the app
// was actually built under. Never hardcode it: a stale literal silently mints push
// tokens for the wrong project, and the pushes then never arrive.
const EAS_PROJECT_ID = (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)
  ?.projectId;

/**
 * Best-effort: obtain this device's Expo push token and register it with the
 * API. Requires notification permission and (on a production build) FCM
 * credentials configured in EAS — failures are silent so login never blocks.
 */
export async function registerPushToken(): Promise<void> {
  const token = useAuth.getState().token;
  if (!token) return;
  try {
    // Ask for notification permission on login if it hasn't been requested yet.
    // SEs/Logistics are also prompted at Start day/run, but admins hit neither —
    // without this they'd never be prompted, register no push token, and receive
    // no pushes. Already-granted users pass straight through (no re-prompt).
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) {
      permission = await Notifications.requestPermissionsAsync();
    }
    if (!permission.granted) return;
    // No projectId in the app config → can't scope a push token; skip silently.
    if (!EAS_PROJECT_ID) return;
    const expoToken = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
    await apiFetch("/me/push-token", {
      method: "POST",
      token,
      // Send the device so the admin Users → Manage sessions screen can name
      // this login's device — this runs on every login, for every role.
      body: {
        token: expoToken.data,
        platform: Platform.OS,
        manufacturer: Device.manufacturer ?? null,
        model: Device.modelName ?? null,
      },
    });
  } catch {
    // No Play services / no FCM credentials / offline — try again next launch.
  }
}
