import { describe, expect, it } from "vitest";
import { relativeDay } from "./relative-date";

// Fixed "now": Tue 29 Sep 2026, local.
const now = new Date(2026, 8, 29, 11, 0, 0);

describe("relativeDay", () => {
  it("returns null for missing / malformed input", () => {
    expect(relativeDay(null, now)).toBeNull();
    expect(relativeDay(undefined, now)).toBeNull();
    expect(relativeDay("", now)).toBeNull();
    expect(relativeDay("not-a-date", now)).toBeNull();
  });

  it("uses 'today' only for the same day, else 'N days ago'", () => {
    expect(relativeDay("2026-09-29", now)).toBe("today");
    expect(relativeDay("2026-09-28", now)).toBe("1 day ago"); // singular, not "yesterday"
    expect(relativeDay("2026-09-26", now)).toBe("3 days ago");
  });

  it("stays in plain days for weeks/months/years-old dates", () => {
    expect(relativeDay("2026-09-22", now)).toBe("7 days ago");
    expect(relativeDay("2026-09-08", now)).toBe("21 days ago");
    expect(relativeDay("2026-08-20", now)).toBe("40 days ago");
    expect(relativeDay("2026-03-01", now)).toBe("212 days ago");
    expect(relativeDay("2025-01-01", now)).toBe("636 days ago");
  });

  it("treats a future date defensively as today", () => {
    expect(relativeDay("2026-10-05", now)).toBe("today");
  });

  it("accepts a full ISO timestamp by slicing the date", () => {
    expect(relativeDay("2026-09-26T00:00:00.000Z", now)).toBe("3 days ago");
  });
});
