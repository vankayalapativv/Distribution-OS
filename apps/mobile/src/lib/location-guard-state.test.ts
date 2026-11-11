import { describe, expect, it } from "vitest";
import { initialGuardState, reduceGuard, REQUIRED_CONSECUTIVE_BAD } from "./location-guard-state";

function feed(readings: (null | "gps_off" | "foreground_denied" | "background_denied")[]) {
  return readings.reduce(reduceGuard, initialGuardState);
}

describe("reduceGuard (debounced location block)", () => {
  it("stays unblocked while healthy", () => {
    expect(feed([null, null, null])).toEqual(initialGuardState);
  });

  it("does NOT block on a single bad reading (cold-start flicker protection)", () => {
    const s = reduceGuard(initialGuardState, "background_denied");
    expect(s.blocked).toBe(false);
    expect(s.consecutiveBad).toBe(1);
  });

  it("blocks only after REQUIRED_CONSECUTIVE_BAD consecutive bad readings", () => {
    const bad = Array(REQUIRED_CONSECUTIVE_BAD - 1).fill("gps_off");
    expect(feed(bad).blocked).toBe(false);
    expect(feed([...bad, "gps_off"]).blocked).toBe(true);
  });

  it("a healthy reading mid-streak resets the counter (no lock-out)", () => {
    const s = feed(["gps_off", "gps_off", null, "gps_off"]);
    expect(s.blocked).toBe(false);
    expect(s.consecutiveBad).toBe(1);
  });

  it("once blocked, stays blocked on further bad readings and tracks the current reason", () => {
    let s = feed(Array(REQUIRED_CONSECUTIVE_BAD).fill("gps_off"));
    expect(s.blocked).toBe(true);
    s = reduceGuard(s, "background_denied");
    expect(s.blocked).toBe(true);
    expect(s.reason).toBe("background_denied"); // reflects what's wrong now
  });

  it("clears IMMEDIATELY once a healthy reading arrives (unblock fast when fixed)", () => {
    const blocked = feed(Array(REQUIRED_CONSECUTIVE_BAD).fill("foreground_denied"));
    expect(blocked.blocked).toBe(true);
    expect(reduceGuard(blocked, null)).toEqual(initialGuardState);
  });
});
