import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSaveDeliveryStop } from "./use-save-delivery-stop";
import type { DeliverableInvoice } from "./deliverable-invoice";
import type { PickedPhoto } from "./photos";

const performSaveDeliveryStop = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const stopIo = vi.fn<(...a: unknown[]) => { io: boolean }>(() => ({ io: true }));
const getLocalDb = vi.fn<() => unknown>();
const getCheckInFix = vi.fn<() => Promise<unknown>>();
const persistDeliveryPhoto = vi.fn((id: string, _photo?: PickedPhoto) => `file:///${id}.jpg`);
let uuidSeq = 0;

vi.mock("expo-crypto", () => ({ randomUUID: () => `uuid-${++uuidSeq}` }));
vi.mock("./auth", () => ({ useAuth: { getState: () => ({ token: "tok" }) } }));
vi.mock("./deliver-stop-actions", () => ({ performSaveDeliveryStop: (...a: unknown[]) => performSaveDeliveryStop(...a) }));
vi.mock("./deliver-stop-io", () => ({ stopIo: (...a: unknown[]) => stopIo(...a) }));
vi.mock("./db", () => ({ getLocalDb: () => getLocalDb() }));
vi.mock("./gps", () => ({ getCheckInFix: () => getCheckInFix() }));
vi.mock("./photos", () => ({ persistDeliveryPhoto: (...a: unknown[]) => persistDeliveryPhoto(...(a as [string, PickedPhoto])) }));

const picked = { id: "inv-1", invoiceNumber: "INV-1", customerId: "c1", customerName: "Balaji" } as DeliverableInvoice;
const photos = [{} as PickedPhoto];
const dbWithServerId = { first: () => ({ server_id: "srv-run-1" }) };

beforeEach(() => {
  uuidSeq = 0;
  getLocalDb.mockReturnValue(dbWithServerId);
  getCheckInFix.mockResolvedValue({ latitude: 17.25, longitude: 80.15 });
});
afterEach(() => vi.clearAllMocks());

describe("useSaveDeliveryStop", () => {
  it("persists photos, takes a GPS fix, resolves the run id and saves the stop", async () => {
    const { result } = renderHook(() => useSaveDeliveryStop("run-1", picked, photos));
    let ok!: boolean;
    await act(async () => { ok = await result.current.save(); });
    expect(ok).toBe(true);
    expect(performSaveDeliveryStop).toHaveBeenCalledWith(
      expect.objectContaining({
        clientUuid: "uuid-1",
        runClientUuid: "run-1",
        runServerId: "srv-run-1",
        invoiceId: "inv-1",
        photoPaths: ["file:///uuid-1-0.jpg"],
        latitude: 17.25,
        longitude: 80.15,
      }),
      { io: true },
    );
    expect(stopIo).toHaveBeenCalledWith("tok");
    expect(result.current.busy).toBe(false);
  });

  it("does nothing without a picked invoice or a run", async () => {
    const noPick = renderHook(() => useSaveDeliveryStop("run-1", null, photos));
    await act(async () => { expect(await noPick.result.current.save()).toBe(false); });
    const noRun = renderHook(() => useSaveDeliveryStop(undefined, picked, photos));
    await act(async () => { expect(await noRun.result.current.save()).toBe(false); });
    expect(performSaveDeliveryStop).not.toHaveBeenCalled();
  });

  it("requires at least one photo", async () => {
    const { result } = renderHook(() => useSaveDeliveryStop("run-1", picked, []));
    await act(async () => { expect(await result.current.save()).toBe(false); });
    expect(result.current.error).toBe("Add at least one photo.");
  });

  it("saves with null coordinates when the GPS fix fails", async () => {
    getCheckInFix.mockRejectedValue(new Error("no fix"));
    const { result } = renderHook(() => useSaveDeliveryStop("run-1", picked, photos));
    await act(async () => { await result.current.save(); });
    expect(performSaveDeliveryStop).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: null, longitude: null }),
      { io: true },
    );
  });

  it("passes a null run server id when the local db is unavailable", async () => {
    getLocalDb.mockReturnValue(null);
    const { result } = renderHook(() => useSaveDeliveryStop("run-1", picked, photos));
    await act(async () => { await result.current.save(); });
    expect(performSaveDeliveryStop).toHaveBeenCalledWith(
      expect.objectContaining({ runServerId: null }),
      { io: true },
    );
  });

  it("surfaces a save failure as a retryable error", async () => {
    performSaveDeliveryStop.mockRejectedValueOnce(new Error("server down"));
    const { result } = renderHook(() => useSaveDeliveryStop("run-1", picked, photos));
    let ok!: boolean;
    await act(async () => { ok = await result.current.save(); });
    expect(ok).toBe(false);
    expect(result.current.error).toBe("server down");
    expect(result.current.busy).toBe(false);
  });

  it("uses a generic message for a non-Error failure", async () => {
    performSaveDeliveryStop.mockRejectedValueOnce("nope");
    const { result } = renderHook(() => useSaveDeliveryStop("run-1", picked, photos));
    await act(async () => { await result.current.save(); });
    expect(result.current.error).toMatch(/Couldn't save this delivery/);
  });

  it("ignores a re-entrant save while one is in flight", async () => {
    let release!: () => void;
    performSaveDeliveryStop.mockReturnValueOnce(new Promise<void>((r) => { release = () => r(); }));
    const { result } = renderHook(() => useSaveDeliveryStop("run-1", picked, photos));
    let first!: Promise<boolean>;
    act(() => { first = result.current.save(); });
    expect(result.current.busy).toBe(true);
    await act(async () => { expect(await result.current.save()).toBe(false); });
    await act(async () => { release(); await first; });
    expect(performSaveDeliveryStop).toHaveBeenCalledOnce();
  });
});
