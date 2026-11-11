import { describe, expect, it } from "vitest";
import { dueBucketMeta } from "./dues-bucket";

describe("dueBucketMeta", () => {
  it("returns null for no bucket", () => {
    expect(dueBucketMeta(null)).toBeNull();
    expect(dueBucketMeta(undefined)).toBeNull();
  });

  it("maps each bucket to a label + colour classes", () => {
    expect(dueBucketMeta("0_30")?.short).toBe("0–30d");
    expect(dueBucketMeta("60_plus")?.label).toBe("61+ days");
    // worse ageing → red; freshest → emerald
    expect(dueBucketMeta("60_plus")?.textClass).toContain("red");
    expect(dueBucketMeta("0_30")?.textClass).toContain("emerald");
  });

  it("ignores an unknown bucket string", () => {
    expect(dueBucketMeta("weird" as never)).toBeNull();
  });
});
