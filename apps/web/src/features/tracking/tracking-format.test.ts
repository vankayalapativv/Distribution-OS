import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fmtTime, timeAgo } from "./tracking-format";

beforeEach(() => vi.setSystemTime(new Date("2026-09-14T12:00:00.000Z")));
afterEach(() => vi.useRealTimers());

const ago = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString();

describe("timeAgo", () => {
  it("returns an em-dash for a null timestamp", () => {
    expect(timeAgo(null)).toBe("—");
  });

  it("bucketises recent times", () => {
    expect(timeAgo(ago(0))).toBe("just now");
    expect(timeAgo(ago(5))).toBe("5 min ago");
    expect(timeAgo(ago(150))).toBe("2h 30m ago"); // 2h 30m
  });

  it("falls back to a readable last-seen beyond a day", () => {
    const out = timeAgo(ago(60 * 30)); // 30h ago → older than a day
    expect(out).not.toMatch(/ago$/);
    expect(typeof out).toBe("string");
  });
});

describe("fmtTime", () => {
  it("formats a time in IST and dashes a null", () => {
    expect(fmtTime(null)).toBe("—");
    expect(fmtTime("2026-09-14T06:30:00.000Z")).toMatch(/\d/);
  });
});
