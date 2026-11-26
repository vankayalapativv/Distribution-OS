import { describe, expect, it } from "vitest";
import { PAYMENT_MODES } from "./constants";

describe("PAYMENT_MODES", () => {
  it("lists the four supported payment modes", () => {
    expect(PAYMENT_MODES.map((m) => m.key)).toEqual(["cash", "cheque", "upi", "neft_rtgs"]);
  });
});
