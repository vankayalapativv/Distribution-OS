import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCheckIn } from "./use-checkin";

const performCheckIn = vi.fn<(...a: unknown[]) => Promise<string | null>>(() => Promise.resolve(null));
const performCheckOut = vi.fn<(...a: unknown[]) => Promise<boolean>>(() => Promise.resolve(false));
const promptReason = vi.fn();
const pickDateTime = vi.fn();

vi.mock("../../components/customer/no-outcome-sheet", () => ({ useNoOutcomeReason: () => ({ promptReason, sheet: "reason-sheet" }) }));
vi.mock("../../components/customer/followup-picker", () => ({ useFollowupPicker: () => ({ pickDateTime, sheet: "followup-sheet" }) }));
vi.mock("./checkin", () => ({ performCheckIn: (...a: unknown[]) => performCheckIn(...a) }));
vi.mock("./checkout", () => ({ performCheckOut: (...a: unknown[]) => performCheckOut(...a) }));

type Overrides = Partial<Parameters<typeof useCheckIn>[0]>;
function makeArgs(o: Overrides = {}) {
  return {
    id: "c1", token: "tok", userId: "u1", role: "SALES_EXECUTIVE", customerName: "Balaji",
    saved: { latitude: 1, longitude: 2 }, serverVisitedToday: false, serverCheckedOut: false,
    serverVisitId: null, confirm: vi.fn<(...a: unknown[]) => Promise<boolean>>(() => Promise.resolve(true)),
    onChanged: vi.fn(), ...o,
  };
}
const setup = (o: Overrides = {}) => { const args = makeArgs(o); return { args, ...renderHook(() => useCheckIn(args)) }; };

beforeEach(() => { performCheckIn.mockResolvedValue(null); performCheckOut.mockResolvedValue(false); });
afterEach(() => vi.clearAllMocks());

describe("useCheckIn state derivation", () => {
  it("is 'none' with a fresh customer", () => {
    expect(setup().result.current.state).toBe("none");
  });
  it("is 'open' when the server says visited-today (not checked out)", () => {
    expect(setup({ serverVisitedToday: true }).result.current.state).toBe("open");
  });
  it("is 'done' when the server says checked out", () => {
    expect(setup({ serverVisitedToday: true, serverCheckedOut: true }).result.current.state).toBe("done");
  });
  it("exposes the sheets", () => {
    const { result } = setup();
    expect(result.current.reasonSheet).toBe("reason-sheet");
    expect(result.current.followupSheet).toBe("followup-sheet");
  });
});

describe("useCheckIn.onPress guards", () => {
  it("does nothing without an id", async () => {
    const { result } = setup({ id: undefined });
    await act(async () => { await result.current.onPress(); });
    expect(performCheckIn).not.toHaveBeenCalled();
  });
  it("does nothing when already done", async () => {
    const { result } = setup({ serverCheckedOut: true });
    await act(async () => { await result.current.onPress(); });
    expect(performCheckIn).not.toHaveBeenCalled();
    expect(performCheckOut).not.toHaveBeenCalled();
  });
  it("ignores a re-entrant press while one is in flight", async () => {
    let release!: () => void;
    performCheckIn.mockReturnValue(new Promise<string | null>((r) => { release = () => r("v1"); }));
    const { result } = setup();
    let first!: Promise<void>;
    act(() => { first = result.current.onPress(); });
    await act(async () => { await result.current.onPress(); }); // guarded by busyRef
    expect(performCheckIn).toHaveBeenCalledTimes(1);
    await act(async () => { release(); await first; });
  });
});

describe("useCheckIn check-in", () => {
  it("stores the new visit and flips to 'open' on success", async () => {
    performCheckIn.mockResolvedValue("v9");
    const { result } = setup();
    await act(async () => { await result.current.onPress(); });
    expect(result.current.state).toBe("open");
    // Next press checks OUT against the session visit id.
    await act(async () => { await result.current.onPress(); });
    expect(performCheckOut).toHaveBeenCalledWith(expect.objectContaining({ visitId: "v9" }));
  });
  it("stays 'none' when check-in is cancelled (no visit id)", async () => {
    performCheckIn.mockResolvedValue(null);
    const { result } = setup();
    await act(async () => { await result.current.onPress(); });
    expect(result.current.state).toBe("none");
  });
  it("shows a Check-in failed dialog when it throws", async () => {
    performCheckIn.mockRejectedValue(new Error("x"));
    const { args, result } = setup();
    await act(async () => { await result.current.onPress(); });
    expect(args.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: "Check-in failed" }));
  });
});

describe("useCheckIn check-out", () => {
  it("closes the visit, flips to 'done' and refreshes the header", async () => {
    performCheckOut.mockResolvedValue(true);
    const { args, result } = setup({ serverVisitedToday: true, serverVisitId: "v0" });
    await act(async () => { await result.current.onPress(); });
    expect(performCheckOut).toHaveBeenCalledWith(expect.objectContaining({ visitId: "v0", customerId: "c1" }));
    expect(result.current.state).toBe("done");
    expect(args.onChanged).toHaveBeenCalled();
  });
  it("keeps 'open' and skips onChanged when check-out is cancelled", async () => {
    performCheckOut.mockResolvedValue(false);
    const { args, result } = setup({ serverVisitedToday: true, serverVisitId: "v0" });
    await act(async () => { await result.current.onPress(); });
    expect(result.current.state).toBe("open");
    expect(args.onChanged).not.toHaveBeenCalled();
  });
  it("tolerates a missing onChanged on success", async () => {
    performCheckOut.mockResolvedValue(true);
    const { result } = setup({ serverVisitedToday: true, serverVisitId: "v0", onChanged: undefined });
    await act(async () => { await result.current.onPress(); });
    expect(result.current.state).toBe("done");
  });
  it("shows an unavailable dialog when there is no visit id to close", async () => {
    const { args, result } = setup({ serverVisitedToday: true, serverVisitId: null });
    await act(async () => { await result.current.onPress(); });
    expect(performCheckOut).not.toHaveBeenCalled();
    expect(args.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: "Check-out unavailable" }));
  });
  it("shows a Check-out failed dialog when it throws", async () => {
    performCheckOut.mockRejectedValue(new Error("x"));
    const { args, result } = setup({ serverVisitedToday: true, serverVisitId: "v0" });
    await act(async () => { await result.current.onPress(); });
    expect(args.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: "Check-out failed" }));
  });
});
