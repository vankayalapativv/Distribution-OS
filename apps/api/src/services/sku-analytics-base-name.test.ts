import { describe, expect, it } from "vitest";
import { baseProductName } from "./sku-analytics";

describe("baseProductName", () => {
  it("strips a trailing combined pack token", () => {
    expect(baseProductName("SILKOLENE SUPER 4 SAE 10W30 900ML")).toBe("SILKOLENE SUPER 4 SAE 10W30");
    expect(baseProductName("TITAN 15W40 5L")).toBe("TITAN 15W40");
    expect(baseProductName("MOTUL 7.5LTR")).toBe("MOTUL");
    expect(baseProductName("GREASE 1L.")).toBe("GREASE");
  });

  it("strips a trailing pack split across a number + unit token", () => {
    expect(baseProductName("TITAN 15W40 5 L")).toBe("TITAN 15W40");
    expect(baseProductName("SILKOLENE 900 ML")).toBe("SILKOLENE");
  });

  it("leaves a name with no trailing pack untouched", () => {
    expect(baseProductName("COOL BLUE COOLANT")).toBe("COOL BLUE COOLANT");
    expect(baseProductName("TITAN 15W40")).toBe("TITAN 15W40");
  });

  it("does not strip when there is no product name before the pack", () => {
    expect(baseProductName("500ML")).toBe("500ML");
    expect(baseProductName("5 L")).toBe("5 L");
  });

  it("trims surrounding whitespace", () => {
    expect(baseProductName("  TITAN 5L  ")).toBe("TITAN");
  });
});
