import { describe, expect, it } from "vitest";
import {
  DEFAULT_SE_STOP_HOUR,
  GPS_TASK,
  LEGACY_UNSCOPED_KEYS,
  MAX_FIX_AGE_MS,
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
    expect(keys).toContain("distribution_os_se_tracking_stop_hour.u1");
  });
});

describe("constants", () => {
  it("exposes the task name, default stop hour and legacy keys", () => {
    expect(GPS_TASK).toBe("distribution-os-day-gps");
    expect(DEFAULT_SE_STOP_HOUR).toBe(19);
    expect(LEGACY_UNSCOPED_KEYS).toContain("distribution_os_day_tracking_on");
  });
});
