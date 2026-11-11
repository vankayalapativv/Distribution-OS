import { describe, expect, it } from "vitest";
import { BUCKET_META, CLEAR_COLOR, bucketColor, bucketLabel, rupees } from "./map-helpers";

describe("bucketColor / bucketLabel", () => {
  it("map a bucket to its dues-accent colour + label", () => {
    expect(bucketColor("0_30")).toBe(BUCKET_META["0_30"].color);
    expect(bucketLabel("60_plus")).toBe("61+ days");
  });
  it("fall back to the neutral colour + 'No dues' for a null bucket", () => {
    expect(bucketColor(null)).toBe(CLEAR_COLOR);
    expect(bucketLabel(null)).toBe("No dues");
  });
});

describe("rupees", () => {
  it("formats with Indian grouping and no paise", () => {
    expect(rupees(1234567)).toBe("₹12,34,567");
    expect(rupees(999.7)).toBe("₹1,000");
  });
});
