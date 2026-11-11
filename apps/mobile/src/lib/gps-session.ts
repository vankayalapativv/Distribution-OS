/**
 * Tracking-session identity: the client session id (persisted + mirrored into
 * module state), its server-side counterpart, and the "day started today" check.
 */
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { apiFetch } from "./api";
import { useAuth } from "./auth";
import { dayFlagIsForToday, istDate } from "./day-flag";
import {
  clientSessionKey,
  dayEndedKey,
  dayOnKey,
  dayStartOdoKey,
  serverSessionKey,
} from "./gps-keys";
import { setClientSessionId } from "./gps-state";

export async function ensureClientSessionId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(clientSessionKey()).catch(() => null);
  if (existing) {
    setClientSessionId(existing);
    return existing;
  }
  // Crypto-strong v4 UUID — the same client-id source orders/collections/delivery
  // use. A local idempotency key, not a security token.
  const next = Crypto.randomUUID();
  await SecureStore.setItemAsync(clientSessionKey(), next).catch(() => undefined);
  setClientSessionId(next);
  return next;
}

export async function createServerSession(
  clientSessionId: string,
  startOdometer?: number | null,
): Promise<void> {
  const token = useAuth.getState().token;
  if (!token) return;
  const data = await apiFetch<{ trackingSessionId: string }>("/tracking-sessions/start", {
    method: "POST",
    token,
    body: { clientSessionId, deviceId: null, startOdometer: startOdometer ?? null },
  });
  await SecureStore.setItemAsync(serverSessionKey(), data.trackingSessionId).catch(() => undefined);
}

/** The AUTHORITATIVE start-day odometer: the active session's start_odometer from
 *  the server. Null when offline or no active session — callers fall back to the
 *  on-device value. */
export async function getServerStartOdometer(): Promise<number | null> {
  const token = useAuth.getState().token;
  if (!token) return null;
  try {
    const data = await apiFetch<{ activeSession: { startOdometer?: number | null } | null }>(
      "/tracking-sessions/active",
      { token },
    );
    const v = data.activeSession?.startOdometer;
    return typeof v === "number" ? v : null;
  } catch {
    return null;
  }
}

/** The whole-km start-day odometer reading stored on this device for the current
 *  user, or null if none (started on another device, or before this feature). */
export async function getDayStartOdometer(): Promise<number | null> {
  const raw = await SecureStore.getItemAsync(dayStartOdoKey()).catch(() => null);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * True only when the day-on flag holds TODAY's IST date. A flag from an earlier
 * day (or the legacy "1" value) is stale — it would otherwise linger as a false
 * "Day is on" (SecureStore survives app updates) — so stale flags are cleared here.
 */
export async function dayStartedToday(): Promise<boolean> {
  const flag = await SecureStore.getItemAsync(dayOnKey()).catch(() => null);
  if (dayFlagIsForToday(flag)) return true;
  if (flag) await SecureStore.deleteItemAsync(dayOnKey()).catch(() => undefined);
  return false;
}

/**
 * True when THIS SE has already ended their day today — the signal that flips the
 * Home button from "End day" to the "Day ended — start again tomorrow" card and
 * blocks a re-start. Like the day-on flag it holds today's IST date; a flag from
 * an earlier day is stale (a fresh day → startable again) and is cleared here.
 */
export async function dayEndedToday(): Promise<boolean> {
  const flag = await SecureStore.getItemAsync(dayEndedKey()).catch(() => null);
  if (dayFlagIsForToday(flag)) return true;
  if (flag) await SecureStore.deleteItemAsync(dayEndedKey()).catch(() => undefined);
  return false;
}

/** Stamp today's "day ended" flag (on a manual End day). */
export async function markDayEndedToday(): Promise<void> {
  await SecureStore.setItemAsync(dayEndedKey(), istDate(Date.now())).catch(() => undefined);
}

/** Clear the "day ended" flag — on a fresh Start day. */
export async function clearDayEnded(): Promise<void> {
  await SecureStore.deleteItemAsync(dayEndedKey()).catch(() => undefined);
}
