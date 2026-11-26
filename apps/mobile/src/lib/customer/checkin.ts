/**
 * Visit check-in for the customer screen — online-first with an offline queue
 * fallback. Tries POST /visits/checkin; if the network is unreachable it records
 * the visit to the local outbox (a `visits` row + a `visit_checkin` queue item)
 * and returns the deterministic clientUuid as the visit handle, so the button
 * flips to "visited today" offline and the write syncs on reconnect.
 */
import * as Crypto from "expo-crypto";
import { apiFetch } from "../api";
import { getLocalDb } from "../db";
import { submitWrite } from "../online-first";
import { handleCheckInOutcome } from "./checkin-outcome";
import { preflightCheckIn } from "./checkin-preflight";
import type { CheckInOpts } from "./checkin-types";
import { recordVisitCheckin } from "./visit-queue";

/**
 * Deterministic clientUuid so a same-day re-check-in is idempotent server-side
 * (no duplicate visit): SHA-256 of `${userId}:${customerId}:${todayIso}`,
 * first 32 hex chars formatted as a UUID.
 */
export async function checkinClientUuid(
  userId: string | undefined,
  customerId: string,
  todayIso: string,
): Promise<string> {
  const seed = `${userId ?? "anon"}:${customerId}:${todayIso}`;
  const h = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, seed);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/** Runs the full gate → fix → geofence → record flow. Returns the visit id if
 *  recorded (so the caller can check out later), or null if not. */
export async function performCheckIn(opts: CheckInOpts): Promise<string | null> {
  const { id, token, userId } = opts;
  // Super Admins visit customers without running a tracking day, so they skip the
  // "Start your day first" gate (they have no beat/day; all visits are ad-hoc).
  const isAdmin = opts.role === "SUPER_ADMIN";

  const pre = await preflightCheckIn(opts, isAdmin);
  if (pre.status === "retry") return performCheckIn(opts);
  if (pre.status === "stop") return null;
  const { fix } = pre;

  // IST calendar day (not UTC) — the deterministic clientUuid must match the
  // field team's day, or a check-in between IST midnight and 05:30 would seed a
  // different day than the server's IST date and lose its idempotency.
  const istDay = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const clientUuid = await checkinClientUuid(userId, id, istDay);
  const payload = { customerId: id, latitude: fix.latitude, longitude: fix.longitude, clientUuid };

  // Online-first: try the server; on a network failure, park it in the durable
  // queue (keyed by clientUuid) so the visit syncs on reconnect.
  const outcome = await submitWrite<{ visitId: string }>({
    send: () => apiFetch<{ visitId: string }>("/visits/checkin", { method: "POST", token, body: payload }),
    queue: () => {
      const db = getLocalDb();
      if (!db) throw new Error("no local db"); // → submitWrite reports "unsaved"
      recordVisitCheckin(db, { clientUuid, customerId: id, latitude: fix.latitude, longitude: fix.longitude }, Date.now());
    },
  });

  return handleCheckInOutcome(outcome, opts, clientUuid);
}
