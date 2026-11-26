import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { preflightCheckIn } from "./checkin-preflight";
import type { CheckInOpts } from "./checkin-types";

const push = vi.fn();
const apiFetch = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve({}));
const checkInFence = vi.fn();
const getCheckInFix = vi.fn();
const isDayTracking = vi.fn<(...a: unknown[]) => Promise<boolean>>(() => Promise.resolve(true));

vi.mock("expo-router", () => ({ router: { push: (...a: unknown[]) => push(...a) } }));
vi.mock("../api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("../geo", () => ({ checkInFence: (...a: unknown[]) => checkInFence(...a) }));
vi.mock("../gps", () => ({
  getCheckInFix: (...a: unknown[]) => getCheckInFix(...a),
  isDayTracking: (...a: unknown[]) => isDayTracking(...a),
}));

const freshFix = { latitude: 17.4, longitude: 78.5, fresh: true };
function makeOpts(o: Partial<CheckInOpts> = {}): CheckInOpts {
  return {
    id: "c1", token: "tok", userId: "u1", customerName: "Balaji",
    saved: { latitude: null, longitude: null }, role: "SALES_EXECUTIVE",
    confirm: vi.fn<(...a: unknown[]) => Promise<boolean>>(() => Promise.resolve(true)), ...o,
  };
}

beforeEach(() => { isDayTracking.mockResolvedValue(true); getCheckInFix.mockResolvedValue(freshFix); });
afterEach(() => vi.clearAllMocks());

describe("preflightCheckIn day gate", () => {
  it("stops an SE whose day isn't started and routes Home on confirm", async () => {
    isDayTracking.mockResolvedValue(false);
    const opts = makeOpts();
    (opts.confirm as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    expect(await preflightCheckIn(opts, false)).toEqual({ status: "stop" });
    expect(push).toHaveBeenCalledWith("/(tabs)");
  });
  it("stops without routing when the SE declines Home", async () => {
    isDayTracking.mockResolvedValue(false);
    const opts = makeOpts();
    (opts.confirm as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    expect(await preflightCheckIn(opts, false)).toEqual({ status: "stop" });
    expect(push).not.toHaveBeenCalled();
  });
  it("skips the day gate for a Super Admin", async () => {
    isDayTracking.mockResolvedValue(false);
    const res = await preflightCheckIn(makeOpts(), true);
    expect(res.status).toBe("ok");
    expect(isDayTracking).not.toHaveBeenCalled();
  });
});

describe("preflightCheckIn GPS", () => {
  it("stops when no fix is available", async () => {
    getCheckInFix.mockResolvedValue(null);
    expect(await preflightCheckIn(makeOpts(), false)).toEqual({ status: "stop" });
  });
  it("stops when the fix is stale", async () => {
    getCheckInFix.mockResolvedValue({ ...freshFix, fresh: false });
    expect(await preflightCheckIn(makeOpts(), false)).toEqual({ status: "stop" });
  });
});

describe("preflightCheckIn geofence", () => {
  it("self-heals a missing saved location by PATCHing the fix (best-effort), then passes", async () => {
    apiFetch.mockRejectedValueOnce(new Error("offline")); // the PATCH is fire-and-forget
    const res = await preflightCheckIn(makeOpts({ saved: { latitude: null, longitude: null } }), false);
    await Promise.resolve(); // let the swallowed .catch settle
    expect(res).toEqual({ status: "ok", fix: freshFix });
    expect(apiFetch).toHaveBeenCalledWith("/customers/c1", expect.objectContaining({ method: "PATCH" }));
  });
  it("passes when inside the fence", async () => {
    checkInFence.mockReturnValue({ allowed: true, distanceM: 20 });
    const res = await preflightCheckIn(makeOpts({ saved: { latitude: 17, longitude: 78 } }), false);
    expect(res.status).toBe("ok");
  });
  it("asks to retry when too far and the SE agrees", async () => {
    checkInFence.mockReturnValue({ allowed: false, distanceM: 1500 });
    const opts = makeOpts({ saved: { latitude: 17, longitude: 78 } });
    (opts.confirm as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    expect(await preflightCheckIn(opts, false)).toEqual({ status: "retry" });
  });
  it("stops when too far and the SE gives up (metre distance formatting)", async () => {
    checkInFence.mockReturnValue({ allowed: false, distanceM: 320 });
    const opts = makeOpts({ saved: { latitude: 17, longitude: 78 } });
    (opts.confirm as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    expect(await preflightCheckIn(opts, false)).toEqual({ status: "stop" });
    const msg = ((opts.confirm as ReturnType<typeof vi.fn>).mock.calls[0][0] as { message: string }).message;
    expect(msg).toContain("320 m");
  });
});
