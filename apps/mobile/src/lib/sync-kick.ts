/**
 * The tracking uploader: single-flighted kickSync() that flushes buffered GPS
 * pings and refreshes the tracking heartbeat. (The write-queue + pull phase were
 * removed when the app went online-required — GPS buffering is the only local
 * persistence left, so tracking survives dead zones.)
 */
import { useAuth } from "./auth";
import { getLocalDb } from "./db";
import { flushGpsPings, flushOnce, getQueueStats } from "./sync-core";
import { prefetchReadData } from "./sync-core-prefetch";
import { sendItem } from "./sync-send";
import { sendGpsBatch } from "./sync-tracking-session";
import { sendTrackingHeartbeatNow } from "./sync-heartbeat";
import { setSyncTrigger, useSyncStore } from "./sync-store";

// The currently-running flush, if any. A second kick while this is in flight
// COALESCES onto it instead of starting a parallel upload.
let inFlight: Promise<void> | null = null;
let flushStartedAt = 0;
// Safety net: if `inFlight` is somehow still set after this (a wedged await),
// don't let it block GPS uploads for the rest of the day — start fresh.
const FLUSH_STUCK_MS = 90_000;

/** Flush buffered GPS pings now (no-op if already running or logged out). */
export async function kickSync(): Promise<void> {
  if (inFlight && Date.now() - flushStartedAt < FLUSH_STUCK_MS) return inFlight;
  if (!useAuth.getState().token) return;
  const db = getLocalDb();
  if (!db) return; // web preview — nothing buffers there

  flushStartedAt = Date.now();
  useSyncStore.setState({ syncing: true });
  const run = (async () => {
    try {
      await flushGpsPings(db, sendGpsBatch);
      // Flush the offline write-queue (check-ins/-outs today; more entities in
      // later phases) FIFO via the per-entity transport, then surface the
      // remaining pending/failed counts on the Settings sync card.
      await flushOnce(db, { send: sendItem }, Date.now());
      useSyncStore.setState({ ...getQueueStats(db), lastSyncedAt: Date.now() });
      await sendTrackingHeartbeatNow();
      // Warm the read-cache in the background (throttled, best-effort) so screens
      // work offline even for records never opened. Fire-and-forget so it never
      // delays the GPS flush or the syncing indicator.
      void prefetchReadData();
    } finally {
      useSyncStore.setState({ syncing: false });
    }
  })();
  inFlight = run;
  try {
    await run;
  } finally {
    if (inFlight === run) inFlight = null;
  }
}

// Let the sync store kick a flush (e.g. the Settings "Retry all") without an
// import cycle (sync-store can't import this module directly).
setSyncTrigger(() => void kickSync());
