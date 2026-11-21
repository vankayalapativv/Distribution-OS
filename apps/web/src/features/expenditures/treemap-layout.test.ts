import { describe, expect, it } from "vitest";
import type { Slice } from "./breakdown-slices";
import { HEIGHT, isTight, layout, share, textColor, type Tile } from "./treemap-layout";

const slice = (amount: number): Slice => ({ key: `k${amount}`, name: `n${amount}`, amount, fill: "#2563eb" });

describe("layout", () => {
  it("places a single item in the whole rectangle (leaf)", () => {
    const out: Tile[] = [];
    layout([slice(10)], 0, 0, 100, 50, out);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ x: 0, y: 0, w: 100, h: 50 });
  });

  it("splits a wide rectangle vertically (w >= h), breaking at the first over-half item", () => {
    const out: Tile[] = [];
    layout([slice(60), slice(40)], 0, 0, 200, 100, out);
    expect(out).toHaveLength(2);
    expect(out[0].x).toBe(0);
    expect(out[1].x).toBeGreaterThan(0);
    expect(out[0].h).toBe(100);
    expect(out[1].h).toBe(100);
  });

  it("splits a tall rectangle horizontally (w < h)", () => {
    const out: Tile[] = [];
    layout([slice(60), slice(40)], 0, 0, 100, 200, out);
    expect(out[0].y).toBe(0);
    expect(out[1].y).toBeGreaterThan(0);
    expect(out[0].w).toBe(100);
    expect(out[1].w).toBe(100);
  });

  it("accumulates until the half-value point before splitting (loop body runs)", () => {
    const out: Tile[] = [];
    layout([slice(40), slice(40), slice(40)], 0, 0, 300, 100, out);
    expect(out).toHaveLength(3);
  });

  it("keeps both sides non-empty when no prefix crosses half (equal amounts)", () => {
    const out: Tile[] = [];
    layout([slice(40), slice(40)], 0, 0, 200, 100, out); // greedy prefix never > half → guard splits 1/1
    expect(out).toHaveLength(2);
    expect(out[0].w).toBeCloseTo(100);
    expect(out[1].w).toBeCloseTo(100);
  });
});

describe("textColor", () => {
  it("returns white on a dark fill", () => expect(textColor("#1d4ed8")).toBe("#ffffff"));
  it("returns dark on a light fill", () => expect(textColor("#93c5fd")).toBe("#0f172a"));
});

describe("isTight", () => {
  it("is tight when narrow", () => expect(isTight(60, 100)).toBe(true));
  it("is tight when short", () => expect(isTight(100, 30)).toBe(true));
  it("is not tight when roomy", () => expect(isTight(100, 100)).toBe(false));
});

describe("share", () => {
  it("rounds a percentage of the total", () => expect(share(250, 1000)).toBe(25));
  it("is 0 when the total is 0", () => expect(share(250, 0)).toBe(0));
});

it("exports a fixed treemap height", () => expect(HEIGHT).toBe(300));
