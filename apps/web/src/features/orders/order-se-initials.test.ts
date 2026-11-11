import { describe, expect, it } from "vitest";
import { initials } from "./order-se-initials";

describe("initials", () => {
  it("returns ? for an empty/blank name", () => {
    expect(initials("")).toBe("?");
    expect(initials("   ")).toBe("?");
  });

  it("takes the first two letters of a single-word name", () => {
    expect(initials("Anika")).toBe("AN");
    expect(initials("A")).toBe("A");
  });

  it("takes first + last initials of a multi-word name", () => {
    expect(initials("Anika Sharma")).toBe("AS");
    expect(initials("john doe smith")).toBe("JS");
  });
});
