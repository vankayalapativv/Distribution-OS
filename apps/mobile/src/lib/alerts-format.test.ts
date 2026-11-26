import { describe, expect, it } from "vitest";
import { timeLabel } from "./alerts-format";

describe("timeLabel", () => {
  it("renders a notification timestamp as 'D MMM · hh:mm AM/PM'", () => {
    // Local-time ISO (no Z) so the assertion is timezone-independent.
    const out = timeLabel("2026-08-05T15:12:00");
    expect(out).toMatch(/^5 Aug · 03:12\s?[AP]M$/i);
  });

  it("zero-pads the hour and keeps a 12-hour clock", () => {
    const out = timeLabel("2026-12-31T09:05:00");
    expect(out).toMatch(/^31 Dec · 09:05\s?[AP]M$/i);
  });
});
