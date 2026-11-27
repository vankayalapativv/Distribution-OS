import { describe, expect, it } from "vitest";
import { claimStatusMeta } from "./claim-status";

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
