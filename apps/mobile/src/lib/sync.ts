/**
 * Sync engine runtime: wires the pure sync-core to the API, the network
 * state, and the app lifecycle.
 *
 * Flush triggers: engine start, network restore, app foreground, and after
 * every enqueued write (call kickSync() from the screens).
 *
 * This is the entry point — the implementation lives in sibling sync-*.ts files
 * and is re-exported here so "./sync" stays the single import path.
 */
export { useSyncStore } from "./sync-store";
export { kickSync } from "./sync-kick";
export { startSyncEngine, stopSyncEngine } from "./sync-engine";
export { sendTrackingHeartbeatNow } from "./sync-heartbeat";
export { getStartDayHealthChecklist, getTrackingHeartbeatDeviceState } from "./sync-device-state";
export { refreshAssignedTasksNow } from "./sync-tasks";
