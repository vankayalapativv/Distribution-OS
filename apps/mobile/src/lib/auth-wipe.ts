/**
 * Shared-device hygiene for login: wipe a PREVIOUS user's local footprint when a
 * DIFFERENT user signs in (e.g. SE A's app was killed without logging out, then
 * SE B logs in). Clears their scoped tracking keys, scheduled reminders, local
 * SQLite (GPS buffer, delivery mirror, reminders, caches, tasks) and the
 * in-memory React Query cache — so none of A's data leaks into B's session. A
 * returning user (same id) skips this and keeps their un-flushed buffer + caches.
 */
import * as Notifications from "expo-notifications";
import { storage } from "./auth-storage";
import { getLocalDb } from "./db";
import { LEGACY_UNSCOPED_KEYS, scopedKeysFor } from "./gps-config";
import { clearAllLocalData } from "./local-db";
import { queryClient } from "./query-client";

export async function wipePreviousUserData(priorUserId: string): Promise<void> {
  const keys = [...scopedKeysFor(priorUserId), ...LEGACY_UNSCOPED_KEYS];
  await Promise.all(keys.map((k) => storage.del(k).catch(() => undefined)));
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
  await Notifications.dismissAllNotificationsAsync().catch(() => undefined);
  const db = getLocalDb();
  if (db) {
    try {
      clearAllLocalData(db);
    } catch {
      // Best-effort — never block login on a cache-clear failure.
    }
  }
  queryClient.clear();
}
