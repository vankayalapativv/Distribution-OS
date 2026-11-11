import { describe, expect, it } from "vitest";
import { GROUPS, STAGE_TINTS } from "./order-fulfillment-summary-groups";

describe("fulfillment summary groups", () => {
  it("has the four funnel groups in order", () => {
    expect(GROUPS.map((g) => g.title)).toEqual(["In progress", "Completed", "Returns", "Cancelled"]);
  });

  it("every group stage has a matching tint", () => {
    for (const g of GROUPS) {
      for (const stage of g.stages) {
        expect(STAGE_TINTS[stage.token]).toBeDefined();
      }
    }
  });

  it("only 'Delivered' is emphasized", () => {
    const emphasized = GROUPS.flatMap((g) => g.stages).filter((s) => s.emphasized);
    expect(emphasized.map((s) => s.token)).toEqual(["delivered"]);
  });
});
