import { describe, expect, it } from "vitest";
import { numStr, str, strOrNull, bool } from "./collections-shared";

describe("collections-shared coercers", () => {
  it("numStr: number/string pass through, else '0'", () => {
    expect(numStr(5)).toBe("5");
    expect(numStr("7")).toBe("7");
    expect(numStr(null)).toBe("0"); // non-number/non-string fallback
  });
  it("str / strOrNull / bool basics", () => {
    expect(str(null)).toBe("");
    expect(strOrNull("")).toBeNull();
    expect(bool(true)).toBe(true);
  });
});
