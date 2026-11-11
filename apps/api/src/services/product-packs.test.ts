import { describe, expect, it } from "vitest";
import { packWriteArrays, parsePacks } from "./product-packs";

describe("parsePacks", () => {
  it("keeps positive sizes (price fields ignored), sorts by size", () => {
    const packs = parsePacks([
      { packSize: 5, mrp: 1200, mop: 1000, dlp: 800 }, // price fields are ignored now
      { packSize: 0.5 },
    ]);
    expect(packs).toEqual([{ packSize: 0.5 }, { packSize: 5 }]);
  });

  it("drops non-positive / non-numeric sizes", () => {
    const packs = parsePacks([
      { packSize: 1 },
      { packSize: 0 },
      { packSize: -2 },
      { packSize: "abc" },
    ]);
    expect(packs).toEqual([{ packSize: 1 }]);
  });

  it("dedupes by pack size", () => {
    const packs = parsePacks([{ packSize: 5 }, { packSize: 5 }]);
    expect(packs).toEqual([{ packSize: 5 }]);
  });

  it("throws 422 when no valid pack survives", () => {
    expect(() => parsePacks([])).toThrow(/at least one pack/i);
    expect(() => parsePacks([{ packSize: 0 }])).toThrow(/at least one pack/i);
  });
});

describe("packWriteArrays", () => {
  it("emits one size per pack", () => {
    const out = packWriteArrays([{ packSize: 0.5 }, { packSize: 1 }, { packSize: 3 }, { packSize: 5 }, { packSize: 10 }]);
    expect(out.sizes).toEqual([0.5, 1, 3, 5, 10]);
  });
});
