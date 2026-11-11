import { afterEach, describe, expect, it, vi } from "vitest";
import { ROLE_DISPLAY, displayName, getFormattedDate, getTimeGreeting } from "./dashboard-greeting";

afterEach(() => vi.useRealTimers());

/** Freeze the clock at a given IST wall-clock hour (offset +05:30), so the
 *  test is independent of the runner's own timezone (CI runs in UTC). */
function atIstHour(hour: number) {
  vi.useFakeTimers();
  const hh = String(hour).padStart(2, "0");
  vi.setSystemTime(new Date(`2026-09-15T${hh}:00:00+05:30`));
}

describe("getTimeGreeting", () => {
  it("greets morning before noon", () => {
    atIstHour(9);
    expect(getTimeGreeting()).toBe("Good morning");
  });
  it("greets afternoon between noon and 5pm", () => {
    atIstHour(14);
    expect(getTimeGreeting()).toBe("Good afternoon");
  });
  it("greets evening from 5pm", () => {
    atIstHour(20);
    expect(getTimeGreeting()).toBe("Good evening");
  });

  // Regression: just after IST midnight the greeting/date must reflect IST,
  // not the server's UTC (which would be the previous evening). Reported bug:
  // 00:14 IST on Tue 22 Sep showed "Good evening" / "Monday, 21 September".
  it("uses IST just after midnight, not server UTC", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-22T00:14:00+05:30")); // 18:44 UTC, 21 Sep
    expect(getTimeGreeting()).toBe("Good morning");
    const date = getFormattedDate();
    expect(date).toContain("22");
    expect(date).toContain("September");
    expect(date).toContain("Tuesday");
  });
});

describe("displayName", () => {
  it("prefers a trimmed user name", () => {
    expect(displayName("MANAGER", "  Murali  ")).toBe("Murali");
  });
  it("falls back to the role label when no name", () => {
    expect(displayName("SUPER_ADMIN")).toBe("Super Admin");
    expect(displayName("ACCOUNTANT", "   ")).toBe("Accountant");
  });
});

describe("ROLE_DISPLAY / getFormattedDate", () => {
  it("labels every role", () => {
    expect(ROLE_DISPLAY.MANAGER).toBe("Manager");
  });
  it("formats a long date including the year", () => {
    atIstHour(10);
    expect(getFormattedDate()).toContain("2026");
  });
});
