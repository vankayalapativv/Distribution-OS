/**
 * SE invoice notifications: Expo push registration and the /me/notifications
 * feed. Invoice PDF download-and-share lives in ./invoice-pdf (re-exported here
 * for existing callers).
 */
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { apiFetch } from "./api";
import { useAuth } from "./auth";

export { downloadInvoicePdf, shareInvoiceFile, shareInvoicePdf } from "./invoice-pdf";

// The EAS projectId that scopes this app's Expo push tokens. Read it from the app
// config (app.json → extra.eas.projectId) so it ALWAYS matches the project the app
// was actually built under. Never hardcode it: a stale literal silently mints push
// tokens for the wrong project, and the pushes then never arrive.
const EAS_PROJECT_ID = (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)
  ?.projectId;

export interface InvoiceNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  invoiceId: string | null;
  /** Dues-bucket alerts carry the customer so the row can open their ledger. */
  customerId: string | null;
  createdAt: string;
  readAt: string | null;
}

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
    const expoToken = await Notifications.getExpoPushTokenAsync({
      projectId: EAS_PROJECT_ID,
    });
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

export async function fetchNotifications(): Promise<InvoiceNotification[]> {
  const token = useAuth.getState().token;
  if (!token) return [];
  const data = await apiFetch<{ notifications: InvoiceNotification[] }>(
    "/me/notifications",
    { token },
  );
  return data.notifications;
}

export async function markNotificationRead(id: string): Promise<void> {
  const token = useAuth.getState().token;
  if (!token) return;
  await apiFetch(`/me/notifications/${id}/read`, { method: "POST", token, body: {} }).catch(
    () => undefined,
  );
}

/** Delete a single notification from the SE's feed. */
export async function deleteNotification(id: string): Promise<void> {
  const token = useAuth.getState().token;
  if (!token) return;
  await apiFetch(`/me/notifications/${id}`, { method: "DELETE", token }).catch(() => undefined);
}

/** Clear the SE's entire notification feed. */
export async function clearAllNotifications(): Promise<void> {
  const token = useAuth.getState().token;
  if (!token) return;
  await apiFetch("/me/notifications", { method: "DELETE", token }).catch(() => undefined);
}
