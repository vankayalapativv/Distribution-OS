import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { formatLastSeen } from "./format";

// Fixed "now" = 2026-08-03 10:00 IST (04:30 UTC) so day buckets are deterministic.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-03T04:30:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("formatLastSeen", () => {
  test("null / empty → em dash", () => {
    expect(formatLastSeen(null)).toBe("—");
    expect(formatLastSeen("")).toBe("—");
  });

  test("today → time only (no day word, no date)", () => {
    const r = formatLastSeen("2026-08-03T03:30:00Z"); // 09:00 IST, same IST day
    expect(r).toMatch(/^\d{1,2}:\d{2}\s?(am|pm)$/i);
    expect(r.toLowerCase()).not.toContain("yesterday");
    expect(r).not.toContain(",");
  });

  test("late-IST-evening ping still counts as today by IST, not UTC", () => {
    // 2026-08-02T20:00:00Z = 01:30 IST on Aug 3 → today in IST
    const r = formatLastSeen("2026-08-02T20:00:00Z");
    expect(r.toLowerCase()).not.toContain("yesterday");
    expect(r).not.toContain(",");
  });

  test("yesterday → 'yesterday <time>'", () => {
    const r = formatLastSeen("2026-08-02T09:30:00Z"); // 15:00 IST Aug 2
    expect(r.toLowerCase()).toMatch(/^yesterday /);
    expect(r.toLowerCase()).toContain("pm");
  });

  test("boundary: 23:30 IST yesterday is 'yesterday', not today", () => {
    const r = formatLastSeen("2026-08-02T18:00:00Z"); // 23:30 IST Aug 2
    expect(r.toLowerCase()).toMatch(/^yesterday /);
  });

  test("older, same year → 'D Mon, <time>' (no year)", () => {
    const r = formatLastSeen("2026-08-01T09:30:00Z"); // 15:00 IST Aug 1
    expect(r).toContain("Aug");
    expect(r).toContain(",");
    expect(r).not.toContain("2026");
    expect(r.toLowerCase()).not.toContain("yesterday");
  });

  test("older, previous year → includes the year", () => {
    const r = formatLastSeen("2025-12-30T09:30:00Z");
    expect(r).toContain("2025");
    expect(r).toContain(",");
  });
});
