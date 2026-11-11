import { describe, expect, it } from "vitest";
import { VIEW_CONFIG, VIEW_ORDER } from "./logistics-views";

describe("logistics VIEW_CONFIG", () => {
  it("lists Runs first, then customers and deliveries", () => {
    expect(VIEW_ORDER).toEqual(["runs", "customers", "deliveries"]);
  });

  it("wires each view to its endpoint, rows key and column count", () => {
    expect(VIEW_CONFIG.runs).toMatchObject({ path: "/logistics/runs", rowsKey: "runs", columnCount: 7, label: "Runs" });
    expect(VIEW_CONFIG.customers).toMatchObject({ path: "/logistics/customers", rowsKey: "customers", columnCount: 5 });
    expect(VIEW_CONFIG.deliveries).toMatchObject({ path: "/logistics/deliveries", rowsKey: "deliveries", columnCount: 5 });
  });

  it("every view has columns, a matching skeleton, an initial sort and a search hint", () => {
    for (const v of VIEW_ORDER) {
      const cfg = VIEW_CONFIG[v];
      expect(cfg.columns.length).toBe(cfg.skeleton.length);
      expect(cfg.columns.length).toBe(cfg.columnCount);
      expect(cfg.initialSort.length).toBeGreaterThan(0);
      expect(cfg.searchPlaceholder).toMatch(/Search/);
    }
  });
});
