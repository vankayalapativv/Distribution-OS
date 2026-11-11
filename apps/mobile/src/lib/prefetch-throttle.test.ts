import { describe, expect, it } from "vitest";
import { shouldPrefetch } from "./prefetch-throttle";

const INTERVAL = 10 * 60 * 1000; // 10 min
const lastAt = 1_000_000;

describe("shouldPrefetch", () => {
  it("SKIPS while inside the throttle window (a plain background→resume before the fix)", () => {
    expect(shouldPrefetch(lastAt + 5_000, lastAt, INTERVAL)).toBe(false);
  });

  it("RUNS once the window has elapsed", () => {
    expect(shouldPrefetch(lastAt + INTERVAL, lastAt, INTERVAL)).toBe(true);
    expect(shouldPrefetch(lastAt + INTERVAL + 1, lastAt, INTERVAL)).toBe(true);
  });

  it("bypassThrottle RUNS even inside the window — the foreground/resume fix", () => {
    expect(shouldPrefetch(lastAt + 5_000, lastAt, INTERVAL, { bypassThrottle: true })).toBe(true);
  });

  it("force RUNS even inside the window", () => {
    expect(shouldPrefetch(lastAt + 5_000, lastAt, INTERVAL, { force: true })).toBe(true);
  });

  it("a cold start (lastAt 0) always runs", () => {
    expect(shouldPrefetch(Date.parse("2026-08-09"), 0, INTERVAL)).toBe(true);
  });
});
