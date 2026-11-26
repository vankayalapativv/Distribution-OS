import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useRunFields } from "./use-run-fields";

describe("useRunFields", () => {
  it("normalises the vehicle number and clears its error on change", () => {
    const { result } = renderHook(() => useRunFields());
    act(() => result.current.setStartErr({ vehicle: "req", odo: "req", photo: "req" }));
    act(() => result.current.changeVehicle("ts 09 ab-1234!"));
    expect(result.current.vehicle).toBe("TS09AB1234");
    expect(result.current.startErr.vehicle).toBeUndefined();
    expect(result.current.startErr.odo).toBe("req"); // other errors untouched
  });

  it("updates odo / endOdo and clears their own errors", () => {
    const { result } = renderHook(() => useRunFields());
    act(() => { result.current.setStartErr({ odo: "bad" }); result.current.setEndErr({ odo: "bad" }); });
    act(() => { result.current.changeOdo("48210"); result.current.changeEndOdo("48297"); });
    expect(result.current.odo).toBe("48210");
    expect(result.current.endOdo).toBe("48297");
    expect(result.current.startErr.odo).toBeUndefined();
    expect(result.current.endErr.odo).toBeUndefined();
  });

  it("clears the start/end photo errors", () => {
    const { result } = renderHook(() => useRunFields());
    act(() => { result.current.setStartErr({ photo: "p" }); result.current.setEndErr({ photo: "p" }); });
    act(() => { result.current.clearStartPhotoErr(); result.current.clearEndPhotoErr(); });
    expect(result.current.startErr.photo).toBeUndefined();
    expect(result.current.endErr.photo).toBeUndefined();
  });

  it("resets the start and end forms", () => {
    const { result } = renderHook(() => useRunFields());
    act(() => { result.current.changeVehicle("TS09"); result.current.changeOdo("1"); result.current.changeEndOdo("2"); });
    act(() => { result.current.setStartErr({ odo: "x" }); result.current.setEndErr({ odo: "y" }); });
    act(() => { result.current.resetStart(); result.current.resetEnd(); });
    expect(result.current.vehicle).toBe("");
    expect(result.current.odo).toBe("");
    expect(result.current.endOdo).toBe("");
    expect(result.current.startErr).toEqual({});
    expect(result.current.endErr).toEqual({});
  });

  it("tracks the form mode", () => {
    const { result } = renderHook(() => useRunFields());
    expect(result.current.mode).toBe("idle");
    act(() => result.current.setMode("start"));
    expect(result.current.mode).toBe("start");
  });
});
