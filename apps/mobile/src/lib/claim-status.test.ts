import { describe, expect, it } from "vitest";
import { claimMoment, claimStatusMeta } from "./claim-status";

describe("claimMoment", () => {
  it("formats a timestamp as date + lowercase time in IST", () => {
    const s = claimMoment("2026-11-28T04:15:51.000Z"); // 09:45 IST, same day
    expect(s).toContain("28 Nov 2026");
    expect(s).toMatch(/\d{1,2}:\d{2}\s?(am|pm)/);
  });
  it("returns the raw value when it isn't a parseable timestamp", () => {
    expect(claimMoment("not-a-date")).toBe("not-a-date");
  });
});

describe("claimStatusMeta", () => {
  it("labels and tones each status", () => {
    expect(claimStatusMeta("approved")).toMatchObject({ label: "Approved" });
    expect(claimStatusMeta("approved").chip).toContain("emerald");
    expect(claimStatusMeta("rejected")).toMatchObject({ label: "Rejected" });
    expect(claimStatusMeta("rejected").chip).toContain("red");
    expect(claimStatusMeta("submitted")).toMatchObject({ label: "Submitted" });
    expect(claimStatusMeta("submitted").chip).toContain("amber");
  });
});
