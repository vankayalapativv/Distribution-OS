import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExecutiveTargets } from "./targets-api";

const apiRequest = vi.fn();
const invalidateQueries = vi.fn();
vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...actual, apiRequest: (...a: unknown[]) => apiRequest(...a) };
});
vi.mock("@tanstack/react-query", () => ({ useMutation: (o: unknown) => realUseMutation(o), useQueryClient: () => ({ invalidateQueries }) }));

// Minimal useMutation stand-in: mutate() runs mutationFn then onSuccess/onError.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function realUseMutation(opts: any) {
  return {
    isPending: false,
    mutate: async () => {
      try { await opts.mutationFn(); opts.onSuccess?.(); }
      catch (e) { opts.onError?.(e); }
    },
  };
}

import { useTargetForm } from "./use-target-form";

const exec: ExecutiveTargets = {
  userId: "u1", name: "Asha",
  perf: { periodStart: "2026-07-01", oilActual: [], oilTarget: [{ segment: "Car", litres: 20 }]},
  currentTarget: { oil: [{ segment: "2W", litres: 9 }]},
};
const config = { apiBaseUrl: "", authToken: "" };
const onCopy = vi.fn();
const onClose = vi.fn();
const setup = () => renderHook(() => useTargetForm(config, exec, "week", "2026-07-06", onCopy, onClose));

beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); apiRequest.mockResolvedValue({}); });
afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("useTargetForm", () => {
  it("seeds from the executive's existing target", () => {
    const { result } = setup();
    expect(result.current.segments.Car).toBe("20");
    expect(result.current.segments["2W"]).toBe(""); // unset → blank
  });

  it("edits a segment and copies form values to the clipboard", () => {
    const { result } = setup();
    act(() => result.current.setSegment("Car", "44"));
    expect(result.current.segments.Car).toBe("44");
    act(() => result.current.handleCopy());
    expect(onCopy).toHaveBeenCalledWith({ oil: expect.objectContaining({ Car: 44 })});
    expect(result.current.copied).toBe(true);
    act(() => vi.advanceTimersByTime(1500));
    expect(result.current.copied).toBe(false);
  });

  it("copyFromCurrent + fillFrom overwrite the fields", () => {
    const { result } = setup();
    act(() => result.current.copyFromCurrent());
    expect(result.current.segments["2W"]).toBe("9");
    act(() => result.current.fillFrom({ oil: { Car: 7 }}));
    expect(result.current.segments.Car).toBe("7");
  });

  it("copyFromCurrent is a no-op when the SE has no current target", () => {
    const noCurrent = { ...exec, currentTarget: null };
    const { result } = renderHook(() => useTargetForm(config, noCurrent, "week", "2026-07-06", onCopy, onClose));
    act(() => result.current.copyFromCurrent());
    expect(result.current.segments.Car).toBe("20"); // unchanged from the seed
  });

  it("save() PUTs the numeric payload and closes", async () => {
    const { result } = setup();
    await act(async () => { await result.current.save.mutate(); });
    expect(apiRequest).toHaveBeenCalledWith(config, "PUT", "/targets/u1", expect.objectContaining({
      periodType: "week", periodDate: "2026-07-06",     }));
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["se-targets"] });
    expect(onClose).toHaveBeenCalled();
  });

  it("surfaces a save error", async () => {
    apiRequest.mockRejectedValueOnce(new Error("Save boom"));
    const { result } = setup();
    await act(async () => { await result.current.save.mutate(); });
    expect(result.current.error).toBe("Save boom");
  });
});
