/**
 * The zustand sync store (pending/failed/syncing counters). Kept separate from
 * kickSync so both the flush engine and the heartbeat can read it without an
 * import cycle; retryFailed triggers a flush through a registered hook.
 */
import { create } from "zustand";
import { getLocalDb } from "./db";
import { getQueueStats, retryFailedItems } from "./sync-core";

// kickSync lives in sync-kick.ts, which imports this store — calling it directly
// from retryFailed would form a cycle. sync-kick registers the trigger instead.
let triggerSync: () => void = () => {};
export function setSyncTrigger(fn: () => void): void {
  triggerSync = fn;
}

export interface SyncState {
  pending: number;
  failed: number;
  syncing: boolean;
  lastSyncedAt: number | null;
  refreshStats: () => void;
  retryFailed: () => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  pending: 0,
  failed: 0,
  syncing: false,
  lastSyncedAt: null,
  refreshStats: () => {
    const db = getLocalDb();
    if (db) set(getQueueStats(db));
  },
  retryFailed: () => {
    const db = getLocalDb();
    if (!db) return;
    retryFailedItems(db, Date.now());
    set(getQueueStats(db));
    triggerSync();
  },
}));
