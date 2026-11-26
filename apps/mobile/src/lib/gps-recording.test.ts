import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { freshDb } from "./sync-core.test-support";

const taskHolder = vi.hoisted(() => ({ cb: null as null | ((e: { data?: unknown; error?: unknown }) => void) }));
const startLocationUpdatesAsync = vi.fn<() => Promise<void>>(() => Promise.resolve());
const kickSync = vi.fn();
let db: ReturnType<typeof freshDb> | null;
let clientSessionId: string | null = "cs-1";

vi.mock("expo-location", () => ({ startLocationUpdatesAsync: () => startLocationUpdatesAsync(), Accuracy: { High: 5 } }));
vi.mock("expo-task-manager", () => ({ defineTask: (_name: string, cb: typeof taskHolder.cb) => { taskHolder.cb = cb; } }));
vi.mock("./db", () => ({ getLocalDb: () => db }));
vi.mock("./gps-config", () => ({
  GPS_TASK: "task", MIN_PING_GAP_MS: 90_000, PING_INTERVAL_MS: 180_000,
  guardedRecordMs: (fixMs: number) => fixMs,
}));
vi.mock("./gps-state", () => ({ getClientSessionId: () => clientSessionId }));
vi.mock("./sync", () => ({ kickSync: () => kickSync() }));

import { recordLocations, startBackgroundUpdates } from "./gps-recording";

function loc(timestamp: number, accuracy: number | null = 8) {
  return { timestamp, coords: { latitude: 17, longitude: 80, accuracy } } as never;
}
const pings = (d: ReturnType<typeof freshDb>) => d.all<{ recorded_at: string }>("select recorded_at from gps_pings order by recorded_at");

beforeEach(() => { db = freshDb(); clientSessionId = "cs-1"; });
afterEach(() => vi.clearAllMocks());

describe("recordLocations", () => {
  it("does nothing without a local db", () => {
    db = null;
    recordLocations([loc(Date.now())]);
    expect(kickSync).not.toHaveBeenCalled();
  });

  it("inserts spaced-out fixes, drops near-duplicates, and kicks sync", () => {
    const live = db!;
    recordLocations([loc(1_000_000, null), loc(1_000_001), loc(1_200_000)]);
    // 1st kept (gap from 0 huge), 2nd dropped (1ms gap), 3rd kept (200s gap)
    expect(pings(live)).toHaveLength(2);
    expect(kickSync).toHaveBeenCalledOnce();
  });

  it("orders by guarded time and continues from the last stored ping", () => {
    const live = db!;
    recordLocations([loc(1_000_000)]);
    kickSync.mockClear();
    recordLocations([loc(1_000_050)]); // 50ms after last → dropped
    expect(pings(live)).toHaveLength(1);
    expect(kickSync).not.toHaveBeenCalled(); // nothing kept → no kick
  });
});

describe("the registered background task", () => {
  it("records locations from the task payload, ignoring errors/empty data", () => {
    const live = db!;
    taskHolder.cb!({ error: new Error("task error") }); // ignored
    taskHolder.cb!({ data: undefined }); // ignored
    taskHolder.cb!({ data: { locations: [loc(1_000_000)] } });
    expect(pings(live)).toHaveLength(1);
  });

  it("tolerates a data payload with no locations array", () => {
    taskHolder.cb!({ data: {} });
    expect(kickSync).not.toHaveBeenCalled();
  });
});

describe("startBackgroundUpdates", () => {
  it("returns true when the updates start", async () => {
    expect(await startBackgroundUpdates()).toBe(true);
  });
  it("returns false when the platform refuses (Expo Go)", async () => {
    startLocationUpdatesAsync.mockRejectedValue(new Error("unavailable"));
    expect(await startBackgroundUpdates()).toBe(false);
  });
});
