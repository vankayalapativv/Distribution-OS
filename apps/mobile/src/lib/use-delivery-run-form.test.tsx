import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDeliveryRunForm, type RunSubmitArgs } from "./use-delivery-run-form";
import type { PickedPhoto } from "./photos";

let seq = 0;
const confirm = vi.fn();
const performStartRun = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const performEndRun = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const startRunIo = vi.fn<(...a: unknown[]) => { io: string }>(() => ({ io: "start" }));
const endRunIo = vi.fn<(...a: unknown[]) => { io: string }>(() => ({ io: "end" }));
const validateStartForm = vi.fn<(...a: unknown[]) => Record<string, unknown>>(() => ({}));
const validateEndForm = vi.fn<(...a: unknown[]) => Record<string, unknown>>(() => ({}));
const hasErrors = vi.fn<(...a: unknown[]) => boolean>(() => false);
const normalizeVehicle = vi.fn((v: string) => v);
const startDayTracking = vi.fn<() => Promise<void>>(() => Promise.resolve());
const stopDayTracking = vi.fn<() => Promise<void>>(() => Promise.resolve());
const runStartDayPermissionSetup = vi.fn<(...a: unknown[]) => Promise<{ ok: boolean }>>(() => Promise.resolve({ ok: true }));
const persistDeliveryPhoto = vi.fn<(...a: unknown[]) => string>(() => "file:///photo.jpg");

vi.mock("expo-crypto", () => ({ randomUUID: () => `uuid-${++seq}` }));
vi.mock("../components/dialog", () => ({ useDialog: () => ({ confirm: (...a: unknown[]) => confirm(...a) }) }));
vi.mock("./auth", () => ({ useAuth: { getState: () => ({ token: "tok" }) } }));
vi.mock("./delivery-run-actions", () => ({
  performStartRun: (...a: unknown[]) => performStartRun(...a),
  performEndRun: (...a: unknown[]) => performEndRun(...a),
}));
vi.mock("./delivery-run-io", () => ({ startRunIo: (...a: unknown[]) => startRunIo(...a), endRunIo: (...a: unknown[]) => endRunIo(...a) }));
vi.mock("./delivery-validation", () => ({
  validateStartForm: (...a: unknown[]) => validateStartForm(...a),
  validateEndForm: (...a: unknown[]) => validateEndForm(...a),
  hasErrors: (...a: unknown[]) => hasErrors(...a),
  normalizeVehicle: (...a: unknown[]) => normalizeVehicle(...(a as [string])),
}));
vi.mock("./gps", () => ({ startDayTracking: () => startDayTracking(), stopDayTracking: () => stopDayTracking() }));
vi.mock("./day-flag", () => ({ istDate: () => "2026-07-15" }));
vi.mock("./permissions", () => ({ runStartDayPermissionSetup: (...a: unknown[]) => runStartDayPermissionSetup(...a) }));
vi.mock("./photos", () => ({ persistDeliveryPhoto: (...a: unknown[]) => persistDeliveryPhoto(...a) }));

function makeFields() {
  return {
    vehicle: "ts09ab1234", odo: "48210", endOdo: "48310",
    setStartErr: vi.fn(), setEndErr: vi.fn(), setMode: vi.fn(), resetStart: vi.fn(), resetEnd: vi.fn(),
  };
}
function makeArgs(over: Partial<RunSubmitArgs> = {}): RunSubmitArgs {
  return {
    active: null, stopsCount: 3, reload: vi.fn(),
    fields: makeFields() as unknown as RunSubmitArgs["fields"],
    odoPhoto: {} as PickedPhoto, endPhoto: {} as PickedPhoto, resetPhotos: vi.fn(),
    ...over,
  };
}
const ACTIVE = { clientUuid: "run-1", serverId: "srv-1", vehicleNumber: "TS09AB1234", startOdometer: 48210, endOdometer: null, status: "active", startedAt: 1_800_000_000_000 };

beforeEach(() => { seq = 0; });
afterEach(() => vi.clearAllMocks());

describe("onStart", () => {
  it("validates, sets up permissions, starts the run and tracking, then resets", async () => {
    const a = makeArgs();
    const { result } = renderHook(() => useDeliveryRunForm(a));
    await act(async () => { await result.current.onStart(); });
    expect(performStartRun).toHaveBeenCalledWith(
      { clientUuid: "uuid-1", vehicleNumber: "ts09ab1234", startOdometer: 48210, runDate: "2026-07-15", startPhotoPath: "file:///photo.jpg" },
      { io: "start" },
    );
    expect(startDayTracking).toHaveBeenCalled();
    expect(a.fields.setMode).toHaveBeenCalledWith("idle");
    expect(a.reload).toHaveBeenCalled();
    expect(result.current.busy).toBe(false);
  });

  it("stops on validation errors", async () => {
    hasErrors.mockReturnValueOnce(true);
    const a = makeArgs();
    const { result } = renderHook(() => useDeliveryRunForm(a));
    await act(async () => { await result.current.onStart(); });
    expect(a.fields.setStartErr).toHaveBeenCalled();
    expect(performStartRun).not.toHaveBeenCalled();
  });

  it("aborts when permission setup is declined", async () => {
    runStartDayPermissionSetup.mockResolvedValueOnce({ ok: false });
    const { result } = renderHook(() => useDeliveryRunForm(makeArgs()));
    await act(async () => { await result.current.onStart(); });
    expect(performStartRun).not.toHaveBeenCalled();
  });

  it("keeps a failed start in the form as an error", async () => {
    performStartRun.mockRejectedValueOnce(new Error("no signal"));
    const { result } = renderHook(() => useDeliveryRunForm(makeArgs()));
    await act(async () => { await result.current.onStart(); });
    expect(result.current.error).toBe("no signal");
  });

  it("tolerates a tracking-start failure", async () => {
    startDayTracking.mockRejectedValueOnce(new Error("gps"));
    const a = makeArgs();
    const { result } = renderHook(() => useDeliveryRunForm(a));
    await act(async () => { await result.current.onStart(); });
    expect(a.reload).toHaveBeenCalled(); // completed despite the tracking failure
  });

  it("uses a generic message for a non-Error start failure", async () => {
    performStartRun.mockRejectedValueOnce("nope");
    const { result } = renderHook(() => useDeliveryRunForm(makeArgs()));
    await act(async () => { await result.current.onStart(); });
    expect(result.current.error).toMatch(/Couldn't start the run/);
  });

  it("ignores a re-entrant start while one is in flight", async () => {
    let release!: () => void;
    performStartRun.mockReturnValueOnce(new Promise<void>((r) => { release = () => r(); }));
    const { result } = renderHook(() => useDeliveryRunForm(makeArgs()));
    let first!: Promise<void>;
    await act(async () => { first = result.current.onStart(); await Promise.resolve(); });
    expect(result.current.busy).toBe(true);
    await act(async () => { await result.current.onStart(); }); // ignored
    await act(async () => { release(); await first; });
    expect(performStartRun).toHaveBeenCalledOnce();
  });
});

describe("onEnd", () => {
  it("ends the run, stops tracking and records the finished summary", async () => {
    const a = makeArgs({ active: ACTIVE });
    const { result } = renderHook(() => useDeliveryRunForm(a));
    await act(async () => { await result.current.onEnd(); });
    expect(performEndRun).toHaveBeenCalledWith(
      { runClientUuid: "run-1", endOdometer: 48310, endPhotoPath: "file:///photo.jpg", runServerId: "srv-1" },
      { io: "end" },
    );
    expect(stopDayTracking).toHaveBeenCalled();
    expect(result.current.finished).toEqual({ vehicle: "TS09AB1234", stops: 3, km: 100 });
  });

  it("does nothing without an active run", async () => {
    const { result } = renderHook(() => useDeliveryRunForm(makeArgs({ active: null })));
    await act(async () => { await result.current.onEnd(); });
    expect(performEndRun).not.toHaveBeenCalled();
  });

  it("stops on end-validation errors", async () => {
    hasErrors.mockReturnValueOnce(true);
    const a = makeArgs({ active: ACTIVE });
    const { result } = renderHook(() => useDeliveryRunForm(a));
    await act(async () => { await result.current.onEnd(); });
    expect(a.fields.setEndErr).toHaveBeenCalled();
    expect(performEndRun).not.toHaveBeenCalled();
  });

  it("records a null distance when the start odometer is unknown", async () => {
    const { result } = renderHook(() => useDeliveryRunForm(makeArgs({ active: { ...ACTIVE, startOdometer: null } })));
    await act(async () => { await result.current.onEnd(); });
    expect(result.current.finished?.km).toBeNull();
  });

  it("keeps a failed end in the form as an error", async () => {
    performEndRun.mockRejectedValueOnce(new Error("end failed"));
    const { result } = renderHook(() => useDeliveryRunForm(makeArgs({ active: ACTIVE })));
    await act(async () => { await result.current.onEnd(); });
    expect(result.current.error).toBe("end failed");
  });

  it("uses a generic message for a non-Error end failure", async () => {
    performEndRun.mockRejectedValueOnce("nope");
    const { result } = renderHook(() => useDeliveryRunForm(makeArgs({ active: ACTIVE })));
    await act(async () => { await result.current.onEnd(); });
    expect(result.current.error).toMatch(/Couldn't end the run/);
  });
});

describe("onEndPress", () => {
  it("enters end mode when confirmed", async () => {
    confirm.mockResolvedValueOnce(true);
    const a = makeArgs();
    const { result } = renderHook(() => useDeliveryRunForm(a));
    await act(async () => { await result.current.onEndPress(); });
    expect(a.fields.setMode).toHaveBeenCalledWith("end");
  });

  it("does nothing when cancelled", async () => {
    confirm.mockResolvedValueOnce(false);
    const a = makeArgs();
    const { result } = renderHook(() => useDeliveryRunForm(a));
    await act(async () => { await result.current.onEndPress(); });
    expect(a.fields.setMode).not.toHaveBeenCalled();
  });
});
