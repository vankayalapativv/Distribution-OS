import { describe, expect, it } from "vitest";
import { isFutureOrderDate, istToday } from "./order-date";

// A fixed "now": 2026-10-03 18:00 UTC = 2026-10-03 23:30 IST (still the 3rd in IST).
const NOW = new Date("2026-10-03T18:00:00Z");

describe("isFutureOrderDate", () => {
  it("rejects a date later than today (IST)", () => {
    expect(isFutureOrderDate("2026-10-04", NOW)).toBe(true);
    expect(isFutureOrderDate("2027-01-01", NOW)).toBe(true);
  });

  it("accepts today and any back-dated (past) date", () => {
    expect(isFutureOrderDate("2026-10-03", NOW)).toBe(false); // today
    expect(isFutureOrderDate("2026-10-02", NOW)).toBe(false); // yesterday
    expect(isFutureOrderDate("2025-06-15", NOW)).toBe(false); // last year
  });

  it("is never future for a missing or malformed date (service defaults/parses it)", () => {
    expect(isFutureOrderDate(null, NOW)).toBe(false);
    expect(isFutureOrderDate(undefined, NOW)).toBe(false);
    expect(isFutureOrderDate("", NOW)).toBe(false);
    expect(isFutureOrderDate("not-a-date", NOW)).toBe(false);
  });

  it("uses the IST calendar day — a late-UTC instant that is already tomorrow in IST", () => {
    // 2026-10-03 20:00 UTC = 2026-10-04 01:30 IST → today is the 4th in IST.
    const istTomorrow = new Date("2026-10-03T20:00:00Z");
    expect(istToday(istTomorrow)).toBe("2026-10-04");
    expect(isFutureOrderDate("2026-10-04", istTomorrow)).toBe(false); // now "today" in IST
    expect(isFutureOrderDate("2026-10-05", istTomorrow)).toBe(true);
  });
});
