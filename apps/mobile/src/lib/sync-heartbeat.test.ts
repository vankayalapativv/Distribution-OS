import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendTrackingHeartbeatNow } from "./sync-heartbeat";

const apiFetch = vi.fn();
const getGpsHeartbeatState = vi.fn<(...a: unknown[]) => unknown>(() => ({ queuedPointCount: 2, lastLocationAt: "t" }));
const sendTrackingHeartbeat = vi.fn<(...a: unknown[]) => Promise<{ sent: boolean }>>();
const ensureServerTrackingSession = vi.fn<(...a: unknown[]) => Promise<string>>(() => Promise.resolve("srv-1"));
const getTrackingHeartbeatDeviceState = vi.fn(() => Promise.resolve({ deviceId: null }));
let token: string | null = "tok";
const getLocalDb = vi.fn<() => unknown>(() => ({ id: "db" }));

vi.mock("./api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("./auth", () => ({ useAuth: { getState: () => ({ token }) } }));
vi.mock("./db", () => ({ getLocalDb: () => getLocalDb() }));
vi.mock("./sync-core", () => ({ getGpsHeartbeatState: (...a: unknown[]) => getGpsHeartbeatState(...a) }));
vi.mock("./tracking-heartbeat", () => ({ sendTrackingHeartbeat: (...a: unknown[]) => sendTrackingHeartbeat(...a) }));
vi.mock("./sync-tracking-session", () => ({ ensureServerTrackingSession: (...a: unknown[]) => ensureServerTrackingSession(...a) }));
vi.mock("./sync-device-state", () => ({ getTrackingHeartbeatDeviceState: () => getTrackingHeartbeatDeviceState() }));
vi.mock("./sync-store", () => ({ useSyncStore: { getState: () => ({ lastSyncedAt: 1234 }) } }));

beforeEach(() => { token = "tok"; getLocalDb.mockReturnValue({ id: "db" }); });
afterEach(() => vi.clearAllMocks());

describe("sendTrackingHeartbeatNow", () => {
  it("does nothing without a token or a db", async () => {
    token = null;
    expect(await sendTrackingHeartbeatNow()).toEqual({ sent: false });
    token = "tok";
    getLocalDb.mockReturnValue(null);
    expect(await sendTrackingHeartbeatNow()).toEqual({ sent: false });
    expect(sendTrackingHeartbeat).not.toHaveBeenCalled();
  });

  it("sends the heartbeat and wires the state getters", async () => {
    sendTrackingHeartbeat.mockResolvedValue({ sent: true });
    const res = await sendTrackingHeartbeatNow();
    expect(res).toEqual({ sent: true });

    const cfg = sendTrackingHeartbeat.mock.calls.at(-1)![0] as {
      getServerSessionId: () => unknown; getQueueState: () => unknown;
      getDeviceState: () => unknown; getLastSuccessfulSyncAt: () => unknown;
      post: (p: string, b: unknown) => unknown;
    };
    cfg.getServerSessionId();
    expect(ensureServerTrackingSession).toHaveBeenCalledWith([]);
    expect(cfg.getQueueState()).toEqual({ queuedPointCount: 2, lastLocationAt: "t" });
    cfg.getDeviceState();
    expect(getTrackingHeartbeatDeviceState).toHaveBeenCalled();
    expect(cfg.getLastSuccessfulSyncAt()).toBe(1234);
    cfg.post("/x", { a: 1 });
    expect(apiFetch).toHaveBeenCalledWith("/x", { method: "POST", token: "tok", body: { a: 1 } });
  });

  it("returns not-sent when the heartbeat throws", async () => {
    sendTrackingHeartbeat.mockRejectedValue(new Error("offline"));
    expect(await sendTrackingHeartbeatNow()).toEqual({ sent: false });
  });
});
