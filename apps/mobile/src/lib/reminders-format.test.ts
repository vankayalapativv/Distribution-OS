import { afterEach, describe, expect, it, vi } from "vitest";
import { formatWhen } from "./reminders-format";

afterEach(() => vi.useRealTimers());

// Freeze "now" to a known LOCAL wall-clock so Today/Tomorrow are deterministic
// regardless of the host timezone (both now and the argument are local).
function freezeAt(y: number, m: number, d: number, h = 9): void {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(y, m, d, h, 0, 0));
}

describe("formatWhen", () => {
  it("labels a same-day time as 'Today · hh:mm AM/PM'", () => {
    freezeAt(2026, 7, 5);
    const out = formatWhen(new Date(2026, 7, 5, 14, 30, 0).getTime());
    expect(out).toMatch(/^Today · 02:30\s?[AP]M$/i);
  });

  it("labels the next day as 'Tomorrow · …'", () => {
    freezeAt(2026, 7, 5);
    const out = formatWhen(new Date(2026, 7, 6, 8, 15, 0).getTime());
    expect(out).toMatch(/^Tomorrow · 08:15\s?[AP]M$/i);
  });

  it("labels a further date as 'D MMM · …'", () => {
    freezeAt(2026, 7, 5);
    const out = formatWhen(new Date(2026, 7, 10, 18, 0, 0).getTime());
    expect(out).toMatch(/^10 Aug · 06:00\s?[AP]M$/i);
  });

  it("does not treat a past day as Today", () => {
    freezeAt(2026, 7, 5);
    const out = formatWhen(new Date(2026, 7, 4, 10, 0, 0).getTime());
    expect(out).toMatch(/^4 Aug · /);
  });
});
