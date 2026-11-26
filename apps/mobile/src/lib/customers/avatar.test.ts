import { describe, expect, it } from "vitest";
import { AVATAR_COLORS, avatarColor, initials } from "./avatar";

describe("initials", () => {
  it("takes the first letter of the first two words", () => {
    expect(initials("Sai Ram Motors")).toBe("SR");
  });
  it("takes two letters from a single word", () => {
    expect(initials("Balaji")).toBe("BA");
    expect(initials("a")).toBe("A");
  });
  it("returns ? for an empty / whitespace name", () => {
    expect(initials("")).toBe("?");
    expect(initials("   ")).toBe("?");
  });
});

describe("avatarColor", () => {
  it("returns a colour from the palette", () => {
    expect(AVATAR_COLORS).toContain(avatarColor("Balaji Auto"));
  });
  it("is stable for the same name", () => {
    expect(avatarColor("Balaji Auto")).toBe(avatarColor("Balaji Auto"));
  });
});
