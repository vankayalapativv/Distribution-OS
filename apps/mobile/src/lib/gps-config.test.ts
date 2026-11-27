import { describe, expect, it } from "vitest";
import {
  GPS_TASK,
  LEGACY_UNSCOPED_KEYS,
  LOGISTICS_CUTOFF_HOUR,
  MAX_FIX_AGE_MS,
  SE_CUTOFF_HOUR,
  guardedRecordMs,
  scopedKeysFor,
  withTimeout,
} from "./gps-config";

describe("withTimeout", () => {
  it("resolves with the promise value when it settles in time", async () => {
    await expect(withTimeout(Promise.resolve("v"), 50, "fb")).resolves.toBe("v");
  });
  it("yields the fallback when the promise rejects", async () => {
    await expect(withTimeout(Promise.reject(new Error("x")), 50, "fb")).resolves.toBe("fb");
  });
  it("yields the fallback when the promise hangs past the timeout", async () => {
    await expect(withTimeout(new Promise<string>(() => {}), 10, "fb")).resolves.toBe("fb");
  });
});

describe("guardedRecordMs", () => {
  const now = 1_000_000_000;
  it("trusts a recent, sane fix timestamp", () => {
    expect(guardedRecordMs(now - 1000, now)).toBe(now - 1000);
  });
  it("stamps with capture time for a stale fix", () => {
    expect(guardedRecordMs(now - MAX_FIX_AGE_MS - 1, now)).toBe(now);
  });
  it("stamps with capture time for a future fix", () => {
    expect(guardedRecordMs(now + 10 * 60_000, now)).toBe(now);
  });
});

describe("scopedKeysFor", () => {
  it("suffixes every scoped base with the user id", () => {
    const keys = scopedKeysFor("u1");
    expect(keys.every((k) => k.endsWith(".u1"))).toBe(true);
    expect(keys).toContain("distribution_os_day_tracking_on.u1");
    expect(keys).not.toContain("distribution_os_se_tracking_stop_hour.u1");
  });
});

describe("constants", () => {
  it("exposes the task name, fixed cutoff hours and legacy keys", () => {
    expect(GPS_TASK).toBe("distribution-os-day-gps");
    expect(SE_CUTOFF_HOUR).toBe(20);
    expect(LOGISTICS_CUTOFF_HOUR).toBe(24);
    expect(LEGACY_UNSCOPED_KEYS).toContain("distribution_os_day_tracking_on");
  });
});
