import { describe, expect, it } from "vitest";
import {
  canClearOpening,
  isLocked,
  todayIso,
  validateOpening,
  type OpeningBalance,
} from "./opening-balance-logic";

const ob = (): OpeningBalance => ({
  id: "o1",
  asOfDate: "2026-03-31",
  openingAmount: 1000,
  amountCollected: 0,
  outstandingAmount: 1000,
  remarks: null,
});

describe("todayIso", () => {
  it("returns a yyyy-MM-dd string", () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("isLocked / canClearOpening", () => {
  it("locks an existing balance for non-super-admins", () => {
    expect(isLocked(ob(), "ACCOUNTANT")).toBe(true);
    expect(isLocked(ob(), "SUPER_ADMIN")).toBe(false);
    expect(isLocked(null, "ACCOUNTANT")).toBe(false);
  });
  it("only lets a super admin clear an existing balance", () => {
    expect(canClearOpening(ob(), "SUPER_ADMIN")).toBe(true);
    expect(canClearOpening(ob(), "ACCOUNTANT")).toBe(false);
    expect(canClearOpening(null, "SUPER_ADMIN")).toBe(false);
  });
});

describe("validateOpening", () => {
  it("rejects a non-numeric or negative amount", () => {
    expect(validateOpening("abc", "2026-03-31")).toEqual({ error: "Enter a valid amount (0 or more)." });
    expect(validateOpening("-5", "2026-03-31")).toEqual({ error: "Enter a valid amount (0 or more)." });
  });
  it("requires an as-of date", () => {
    expect(validateOpening("100", "")).toEqual({ error: "Pick an as-of date." });
  });
  it("returns the parsed value when valid (0 allowed)", () => {
    expect(validateOpening("0", "2026-03-31")).toEqual({ value: 0 });
    expect(validateOpening("2500.5", "2026-03-31")).toEqual({ value: 2500.5 });
  });
});
