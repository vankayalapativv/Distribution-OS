import { describe, expect, it } from "vitest";
import { collectionChip, orderChip } from "./map-chips";

describe("orderChip", () => {
  it("is red 'No orders yet' when never ordered", () => {
    expect(orderChip(null).label).toBe("No orders yet");
    expect(orderChip(null).fg).toBe("#b91c1c");
  });
  it("is green within 21 days (and labels 'today' at 0)", () => {
    expect(orderChip(0)).toMatchObject({ label: "Last order today", bg: "#dcfce7" });
    expect(orderChip(21).bg).toBe("#dcfce7");
  });
  it("is orange between 22 and 30 days", () => {
    expect(orderChip(30)).toMatchObject({ label: "Last order 30 days ago", bg: "#ffedd5" });
  });
  it("is red past 30 days (singular day label at 1 is still green)", () => {
    expect(orderChip(1).label).toBe("Last order 1 day ago");
    expect(orderChip(45).bg).toBe("#fee2e2");
  });
});

describe("collectionChip", () => {
  it("is red 'No collections yet' when never collected", () => {
    expect(collectionChip(null).label).toBe("No collections yet");
  });
  it("is green ≤7, orange 8–14, red 15+", () => {
    expect(collectionChip(7).bg).toBe("#dcfce7");
    expect(collectionChip(14).bg).toBe("#ffedd5");
    expect(collectionChip(20).bg).toBe("#fee2e2");
  });
});
