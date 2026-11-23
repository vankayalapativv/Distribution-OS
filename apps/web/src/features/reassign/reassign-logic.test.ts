import { describe, expect, it } from "vitest";
import { COUNT_LABELS, avatarColor, initials, totalCount } from "./reassign-logic";

const counts = { orders: 24, collections: 11, invoices: 23, visits: 38, photos: 9, notes: 5, beatDays: 2 };

describe("reassign-logic", () => {
  it("totalCount sums all 7 record types", () => {
    expect(COUNT_LABELS).toHaveLength(7);
    expect(totalCount(counts)).toBe(112);
  });

  it("initials: two words → two letters, one word → one, blank → ?", () => {
    expect(initials("Priya Field")).toBe("PF");
    expect(initials("Vishnu")).toBe("V");
    expect(initials("   ")).toBe("?");
  });

  it("avatarColor is deterministic and from the bg-* palette", () => {
    expect(avatarColor("owner-1")).toBe(avatarColor("owner-1"));
    expect(avatarColor("owner-1")).toMatch(/^bg-/);
    expect(avatarColor("")).toMatch(/^bg-/); // no chars → first colour
  });
});
