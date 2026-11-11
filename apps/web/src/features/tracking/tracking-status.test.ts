import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isFresh, statusDot, statusLabel, statusTone } from "./tracking-status";
import type { TrackedExecutive } from "./tracking-api";

beforeEach(() => vi.setSystemTime(new Date("2026-09-14T12:00:00.000Z")));
afterEach(() => vi.useRealTimers());

const ex = (over: Partial<TrackedExecutive> = {}): TrackedExecutive => ({ userId: "u1", ...over } as TrackedExecutive);
// Absolute times relative to the fixed fake "now" (12:00Z) so isLive (<12 min) is deterministic.
const liveAt = "2026-09-14T11:59:00.000Z"; // 1 min ago → live
const staleAt = "2026-09-14T11:30:00.000Z"; // 30 min ago → not live

describe("statusLabel", () => {
  it("prefers the API label, then live/session-based fallbacks", () => {
    expect(statusLabel(ex({ trackingStatusLabel: "GPS disabled" }))).toBe("GPS disabled");
    expect(statusLabel(ex({ lastRecordedAt: liveAt }))).toBe("Fresh");
    expect(statusLabel(ex({ lastRecordedAt: staleAt, sessionStatus: "active" }))).toBe("Delayed");
    expect(statusLabel(ex({ lastRecordedAt: staleAt, sessionStatus: "ended" }))).toBe("Day ended");
  });
});

describe("isFresh", () => {
  it("uses the API status when present, else liveness", () => {
    expect(isFresh(ex({ trackingStatus: "fresh" }))).toBe(true);
    expect(isFresh(ex({ trackingStatus: "delayed" }))).toBe(false);
    expect(isFresh(ex({ lastRecordedAt: liveAt }))).toBe(true);
    expect(isFresh(ex({ lastRecordedAt: null }))).toBe(false);
  });
});

describe("statusTone", () => {
  it("maps each tracking status to a tone", () => {
    expect(statusTone(ex({ trackingStatus: "fresh" }))).toMatch(/green/);
    expect(statusTone(ex({ trackingStatus: "locating" }))).toMatch(/amber/);
    expect(statusTone(ex({ trackingStatus: "tracking_interrupted" }))).toMatch(/red/);
    expect(statusTone(ex({ trackingStatus: "day_ended" }))).toMatch(/slate/);
    expect(statusTone(ex({ lastRecordedAt: liveAt }))).toMatch(/green/);
    expect(statusTone(ex({ lastRecordedAt: staleAt }))).toMatch(/slate/);
  });
});

describe("statusDot", () => {
  it("maps each tracking status to a dot colour", () => {
    expect(statusDot(ex({ trackingStatus: "fresh" }))).toBe("bg-green-500");
    expect(statusDot(ex({ trackingStatus: "offline_upload_delayed" }))).toBe("bg-amber-500");
    expect(statusDot(ex({ trackingStatus: "gps_disabled" }))).toBe("bg-red-500");
    expect(statusDot(ex({ lastRecordedAt: liveAt }))).toBe("bg-green-500");
    expect(statusDot(ex({ lastRecordedAt: staleAt }))).toBe("bg-slate-400");
  });
});

// Cover every switch-case label in statusTone / statusDot.
describe("statusTone / statusDot — all statuses", () => {
  const amber = ["delayed", "locating", "offline_upload_delayed"] as const;
  const red = ["gps_disabled", "permission_missing", "tracking_interrupted"] as const;
  it.each(amber)("%s is amber", (s) => {
    expect(statusTone(ex({ trackingStatus: s }))).toMatch(/amber/);
    expect(statusDot(ex({ trackingStatus: s }))).toBe("bg-amber-500");
  });
  it.each(red)("%s is red", (s) => {
    expect(statusTone(ex({ trackingStatus: s }))).toMatch(/red/);
    expect(statusDot(ex({ trackingStatus: s }))).toBe("bg-red-500");
  });
  it("day_ended is slate (tone) and a slate dot via the default", () => {
    expect(statusTone(ex({ trackingStatus: "day_ended", lastRecordedAt: staleAt }))).toMatch(/slate/);
    expect(statusDot(ex({ trackingStatus: "day_ended", lastRecordedAt: staleAt }))).toBe("bg-slate-400");
  });
  it("signed_out is calm slate (tone) and a slate dot, distinct from red interrupted", () => {
    expect(statusTone(ex({ trackingStatus: "signed_out", lastRecordedAt: staleAt }))).toMatch(/slate/);
    expect(statusDot(ex({ trackingStatus: "signed_out", lastRecordedAt: staleAt }))).toBe("bg-slate-400");
  });
});
