import { describe, expect, it } from "vitest";
import {
  buildFeed, durationLabel, isAdminRole, missedForPage, pageCountOf,
  productivityPct, roleProductivityPct, visitorRoleLabel,
  type MissedRow, type VisitRoleStat, type VisitRow, type VisitsData,
} from "./customer-visits-logic";

describe("pageCountOf / productivityPct", () => {
  it("computes page count (min 1) and productivity %", () => {
    expect(pageCountOf(0)).toBe(1);
    expect(pageCountOf(9)).toBe(2);
    expect(productivityPct(undefined)).toBeNull();
    expect(productivityPct({ total: 0, productive: 0 } as VisitsData)).toBeNull();
    expect(productivityPct({ total: 4, productive: 3 } as VisitsData)).toBe(75);
  });
});

describe("missedForPage", () => {
  it("places a missed row on the page implied by its newer count (clamped)", () => {
    const rows: MissedRow[] = [
      { date: "d1", at: null, executiveName: "A", newer: 0 }, // page 1
      { date: "d2", at: null, executiveName: "A", newer: 8 }, // page 2
      { date: "d3", at: null, executiveName: "A", newer: 999 }, // clamped to last page
    ];
    expect(missedForPage(rows, 2, 1).map((m) => m.date)).toEqual(["d1"]);
    expect(missedForPage(rows, 2, 2).map((m) => m.date)).toEqual(["d2", "d3"]);
  });
});

describe("visitorRoleLabel / isAdminRole", () => {
  it("labels each role code, '—' for unknown, and flags Super-Admin", () => {
    expect(visitorRoleLabel("SUPER_ADMIN")).toBe("Super Admin");
    expect(visitorRoleLabel("SALES_EXECUTIVE")).toBe("Executive");
    expect(visitorRoleLabel("MANAGER")).toBe("Manager");
    expect(visitorRoleLabel("ACCOUNTANT")).toBe("Accountant");
    expect(visitorRoleLabel("LOGISTICS")).toBe("Logistics");
    expect(visitorRoleLabel("NOPE")).toBe("—");
    expect(isAdminRole("SUPER_ADMIN")).toBe(true);
    expect(isAdminRole("MANAGER")).toBe(false);
  });
});

describe("durationLabel / roleProductivityPct", () => {
  it("formats minutes (null / <1h / ≥1h)", () => {
    expect(durationLabel(null)).toBe("—");
    expect(durationLabel(24)).toBe("24 min");
    expect(durationLabel(65)).toBe("1 h 05 m");
  });
  it("productivity % per role, null without visits", () => {
    expect(roleProductivityPct(undefined)).toBeNull();
    expect(roleProductivityPct({ total: 0, productive: 0 } as VisitRoleStat)).toBeNull();
    expect(roleProductivityPct({ total: 2, productive: 1 } as VisitRoleStat)).toBe(50);
  });
});

describe("buildFeed", () => {
  it("merges visits + missed rows newest-first", () => {
    const rows = [{ id: "v1", checkInTime: "2026-07-02T10:00:00", visitDate: null } as VisitRow];
    const missed: MissedRow[] = [{ date: "2026-07-03", at: "2026-07-03T19:00:00", executiveName: "A", newer: 0 }];
    const feed = buildFeed(rows, missed);
    expect(feed[0].kind).toBe("missed"); // 3rd is newer than 2nd
    expect(feed[1].kind).toBe("visit");
  });
});
