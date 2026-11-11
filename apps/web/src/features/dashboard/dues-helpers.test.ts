import { describe, expect, it } from "vitest";
import { DUES_ACCENT, type DuesBucketKey } from "./dues-helpers";

describe("DUES_ACCENT", () => {
  it("maps every bucket to a hotter-with-age border accent", () => {
    const keys: DuesBucketKey[] = ["0_30", "30_45", "45_60", "60_plus"];
    expect(Object.keys(DUES_ACCENT)).toEqual(keys);
    expect(DUES_ACCENT["0_30"]).toBe("border-l-emerald-300");
    expect(DUES_ACCENT["60_plus"]).toBe("border-l-rose-300");
  });
});
