import { describe, expect, it } from "vitest";
import { matchesQuery, WEEKDAYS } from "./beat-plans-api";
import type { BeatCustomer } from "./beat-plans-api";

const c: BeatCustomer = {
  customerId: "1", customerCode: "CUST-9", legalName: "Acme Traders", tradeName: "Acme",
  phone: "9876500000", city: "Mancherial", segment: null, weekday: null, sequenceNo: 0,
};

describe("matchesQuery", () => {
  it("matches (case-insensitively) across name, trade name, phone, city and code", () => {
    expect(matchesQuery(c, "")).toBe(true); // blank → all
    expect(matchesQuery(c, "acme")).toBe(true);
    expect(matchesQuery(c, "MANCHER")).toBe(true);
    expect(matchesQuery(c, "98765")).toBe(true);
    expect(matchesQuery(c, "cust-9")).toBe(true);
    expect(matchesQuery(c, "nope")).toBe(false);
  });
  it("tolerates null fields (evaluates every field, coalescing null to '')", () => {
    // Query matches nothing, so .some() evaluates all fields incl. the null ones.
    expect(matchesQuery({ ...c, tradeName: null, phone: null, city: null }, "zzz")).toBe(false);
    // Match found only on the last field after skipping the nulls.
    expect(matchesQuery({ ...c, legalName: "", tradeName: null, phone: null, city: null }, "cust-9")).toBe(true);
  });
});

describe("WEEKDAYS", () => {
  it("is Monday–Saturday, 1-indexed", () => {
    expect(WEEKDAYS.map((d) => d.value)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(WEEKDAYS[0]).toMatchObject({ label: "Mon", full: "Monday" });
    expect(WEEKDAYS[5]).toMatchObject({ label: "Sat", full: "Saturday" });
  });
});
