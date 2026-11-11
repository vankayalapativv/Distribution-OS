import { describe, expect, it } from "vitest";
import { buildSlices } from "./breakdown-slices";
import type { ExpenditureSummary } from "./expenditures-api";

const cat = (id: string, amount: number, type: "compulsory" | "variable" = "variable"): ExpenditureSummary["categories"][number] => ({
  categoryId: id, categoryName: id, type, entries: 1, amount,
});

describe("buildSlices", () => {
  it("gives each type its own descending shade ramp", () => {
    const slices = buildSlices([cat("c1", 100, "compulsory"), cat("c2", 90, "compulsory"), cat("v1", 80, "variable")]);
    expect(slices.map((s) => s.key)).toEqual(["c1", "c2", "v1"]);
    expect(slices[0].fill).toBe("#1d4ed8"); // first compulsory shade
    expect(slices[1].fill).toBe("#2563eb"); // second compulsory shade
    expect(slices[2].fill).toBe("#334155"); // first variable shade
  });

  it("rolls categories beyond the top 10 into a single 'Other' slice", () => {
    const cats = Array.from({ length: 13 }, (_, i) => cat(`c${i}`, 100 - i));
    const slices = buildSlices(cats);
    expect(slices).toHaveLength(11); // 10 + Other
    const other = slices.at(-1)!;
    expect(other.key).toBe("__other__");
    expect(other.name).toBe("Other (3)");
    expect(other.amount).toBe(cats.slice(10).reduce((a, c) => a + c.amount, 0));
  });

  it("has no Other slice with ≤10 categories", () => {
    expect(buildSlices([cat("c1", 5)]).some((s) => s.key === "__other__")).toBe(false);
  });
});
