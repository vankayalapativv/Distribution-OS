import { describe, expect, test } from "vitest";
import { dateOf, dateStr, likeOf, num, numOrNull, str, strOrNull } from "./logistics-shared";

describe("logistics-shared coercion helpers", () => {
  test("str handles string, Date and nullish", () => {
    expect(str("hi")).toBe("hi");
    expect(str(new Date("2026-09-14T00:00:00Z"))).toBe("2026-09-14T00:00:00.000Z");
    expect(str(null)).toBe("");
    expect(str(42)).toBe("42");
  });

  test("strOrNull returns null for empty, else the string", () => {
    expect(strOrNull("")).toBeNull();
    expect(strOrNull(null)).toBeNull();
    expect(strOrNull("x")).toBe("x");
  });

  test("dateStr handles Date, string and unknown", () => {
    expect(dateStr(new Date("2026-09-14T10:00:00Z"))).toBe("2026-09-14");
    expect(dateStr("2026-09-14T10:00:00Z")).toBe("2026-09-14");
    expect(dateStr(123)).toBe("");
    expect(dateStr(null)).toBe("");
  });

  test("num / numOrNull coerce", () => {
    expect(num("45")).toBe(45);
    expect(num(null)).toBe(0);
    expect(numOrNull(null)).toBeNull();
    expect(numOrNull("7")).toBe(7);
  });
});

describe("logistics-shared filter helpers", () => {
  test("likeOf wraps non-blank queries and nulls blanks", () => {
    expect(likeOf("  ram ")).toBe("%ram%");
    expect(likeOf("")).toBeNull();
    expect(likeOf(null)).toBeNull();
  });

  test("dateOf accepts YYYY-MM-DD and rejects anything else", () => {
    expect(dateOf("2026-09-14")).toBe("2026-09-14");
    expect(dateOf(" 2026-09-14 ")).toBe("2026-09-14");
    expect(dateOf("14/09/2026")).toBeNull();
    expect(dateOf(null)).toBeNull();
  });
});
