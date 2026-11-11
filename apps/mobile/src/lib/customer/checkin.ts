/**
 * Visit check-in for the customer screen — online-first with an offline queue
 * fallback. Tries POST /visits/checkin; if the network is unreachable it records
 * the visit to the local outbox (a `visits` row + a `visit_checkin` queue item)
 * and returns the deterministic clientUuid as the visit handle, so the button
 * flips to "visited today" offline and the write syncs on reconnect.
 */
import * as Crypto from "expo-crypto";
import { router } from "expo-router";
import type { ConfirmOptions } from "../../components/dialog";
import { apiFetch } from "../api";
import { ApiRequestError } from "../api-core";
import { getLocalDb } from "../db";
import { checkInFence } from "../geo";
import { getCheckInFix, isDayTracking } from "../gps";
import { submitWrite, type WriteOutcome } from "../online-first";
import { kickSync } from "../sync";
import type { LocalDb } from "../local-db";
import { getOpenFollowup, resolveFollowupLocal } from "./followups";
import { recordVisitCheckin } from "./visit-queue";

type Confirm = (opts: ConfirmOptions) => Promise<boolean>;

/** "12 Oct, 3:00 pm" for the follow-up popup. */
function formatFollowupDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** After a check-in, surface the customer's latest OPEN follow-up ("said next
 *  week — payment") and let the SE mark it done. Offline-first (reads the local
 *  mirror). No-op when there's no open follow-up or no local store. */
async function showFollowupIfAny(
  db: LocalDb | null,
  customerId: string,
  customerName: string,
  confirm: Confirm,
  token: string | null,
): Promise<void> {
  if (!db) return;
  const open = getOpenFollowup(db, customerId);
  if (!open) return;
  const when = open.followUpAt ? `\n\nFollow up: ${formatFollowupDate(open.followUpAt)}` : "";
  const done = await confirm({
    title: "Pending follow-up",
    message: `Last visit, ${customerName} said:\n"${open.reason}"${when}`,
    confirmLabel: "Mark done",
    cancelLabel: "OK",
  });
  if (!done) return;
  resolveFollowupLocal(db, customerId);
  // Best-effort server resolve (office view + stops the push); local is already done.
  void apiFetch(`/followups/customers/${customerId}/resolve`, { method: "POST", token }).catch(
    () => undefined,
  );
}

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

interface CheckInOpts {
  id: string;
  token: string | null;
  userId: string | undefined;
  customerName: string;
  saved: { latitude: number | null; longitude: number | null };
  /** Visitor's role — a SUPER_ADMIN checks in WITHOUT starting a day. */
  role: string | undefined;
  confirm: Confirm;
}

/** A GPS fix that passed the null + freshness checks. */
type CheckInFix = NonNullable<Awaited<ReturnType<typeof getCheckInFix>>>;

/** "1.2 km" past a kilometre, else "320 m" — the distance in the too-far prompt. */
function formatDistanceAway(distanceM: number): string {
  if (distanceM >= 1000) return `${(distanceM / 1000).toFixed(1)} km`;
  return `${distanceM} m`;
}

/** Preflight result: proceed with the fix, stop silently, or re-run the flow. */
type Preflight = { status: "ok"; fix: CheckInFix } | { status: "stop" } | { status: "retry" };

/**
 * Day-gate (SE only) → fresh GPS fix → geofence (or self-heal when the customer
 * has no saved location). Returns the validated fix, or asks the caller to stop
 * or retry. Each failing step shows its own dialog.
 */
async function preflightCheckIn(opts: CheckInOpts, isAdmin: boolean): Promise<Preflight> {
  const { id, token, customerName, saved, confirm } = opts;

  // Starting the day belongs to the Home-screen Start-day button, which owns the
  // whole permission + GPS-tracking flow. The check-in button must NOT start the
  // day itself: doing it inline here and then immediately checking in raced the
  // just-started tracking session and failed the FIRST check-in ("check your
  // connection") while a second tap (day already on) worked. So when the day
  // isn't started, point the SE to Home and stop — no inline start. Super Admins
  // have no beat/day (all visits ad-hoc), so they skip this gate.
  if (!isAdmin && !(await isDayTracking())) {
    const goHome = await confirm({
      title: "Start your day first",
      message: "Go to the Home screen and tap Start day before checking in at a customer.",
      confirmLabel: "Go to Home",
      cancelLabel: "OK",
    });
    if (goHome) router.push("/(tabs)");
    return { status: "stop" };
  }

  const fix = await getCheckInFix();
  if (!fix) {
    void confirm({
      title: "Location required",
      message: "Check-in records where you are — enable location permission and try again.",
      confirmLabel: "OK",
    });
    return { status: "stop" };
  }

  // The geofence needs a FRESH reading — a stale last-known fix (e.g. from an
  // earlier shop) could wrongly pass the fence. Make the SE retry for a real fix.
  if (!fix.fresh) {
    void confirm({
      title: "Getting your location",
      message:
        "Couldn't get a fresh GPS reading. Move to an open area, wait a moment, and try again.",
      confirmLabel: "OK",
    });
    return { status: "stop" };
  }

  if (saved.latitude != null && saved.longitude != null) {
    const fence = checkInFence(fix, { latitude: saved.latitude, longitude: saved.longitude });
    if (!fence.allowed) {
      const retry = await confirm({
        title: "Too far from the shop",
        message: `You're about ${formatDistanceAway(fence.distanceM)} from ${customerName}'s saved location. Move within 100 m to check in.`,
        confirmLabel: "Try again",
      });
      return retry ? { status: "retry" } : { status: "stop" };
    }
  } else {
    // No saved location yet: self-heal by saving this fix online (no local write).
    void apiFetch(`/customers/${id}`, {
      method: "PATCH",
      token,
      body: { latitude: fix.latitude, longitude: fix.longitude },
    }).catch(() => undefined);
  }

  return { status: "ok", fix };
}

/**
 * OPEN_VISIT rejection: the SE is still checked in at another shop. Offer a jump
 * straight to that open customer so they can check out there. Returns true when
 * handled (there was a target customer), false to fall through to a generic error.
 */
async function offerGoToOpenVisit(error: ApiRequestError, confirm: Confirm): Promise<boolean> {
  const details = error.details as { customerId?: string; customerName?: string } | undefined;
  if (!details?.customerId) return false;
  const go = await confirm({
    title: "Finish your current visit",
    message: error.message, // "Finish your visit at <shop> first."
    confirmLabel: "Go to visit",
    cancelLabel: "Not now",
  });
  if (go) {
    router.push({
      pathname: "/customer/[id]",
      params: { id: details.customerId, name: details.customerName ?? "" },
    });
  }
  return true;
}

/** Turn the write outcome into a result: the visit handle on success, or an
 *  explanatory dialog + null on queue (offline) / reject / unsaved. */
async function handleCheckInOutcome(
  outcome: WriteOutcome<{ visitId: string }>,
  opts: CheckInOpts,
  clientUuid: string,
): Promise<string | null> {
  const { id, token, customerName, confirm } = opts;

  if (outcome.status === "sent") {
    await showFollowupIfAny(getLocalDb(), id, customerName, confirm, token);
    return outcome.data.visitId ?? clientUuid;
  }
  if (outcome.status === "queued") {
    void kickSync(); // best-effort immediate flush attempt
    await showFollowupIfAny(getLocalDb(), id, customerName, confirm, token);
    return clientUuid; // the local visit handle; checkout resolves it via the local row
  }

  const rejection =
    outcome.status === "rejected" && outcome.error instanceof ApiRequestError ? outcome.error : null;

  if (rejection?.code === "OPEN_VISIT" && (await offerGoToOpenVisit(rejection, confirm))) {
    return null;
  }

  // Other rejections (permanent 4xx) or unsaved (no local DB). On a rejection,
  // surface the SERVER's own message (e.g. "You've already completed a visit here
  // today.") so the SE knows WHY, instead of a generic "pull to refresh".
  const message =
    outcome.status === "unsaved"
      ? "Couldn't save the check-in on this device. Try again."
      : (rejection?.message ?? "The server rejected this check-in. Pull to refresh and try again.");
  void confirm({ title: "Check-in failed", message, confirmLabel: "OK" });
  return null;
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
