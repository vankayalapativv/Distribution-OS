import { describe, expect, it } from "vitest";
import {
  optionalBoolean,
  optionalNumber,
  optionalString,
  readJsonObject,
  requiredNumber,
  requiredString,
} from "./request-body";
import type { Context } from "hono";
import type { ApiEnv } from "../types";

function ctxWithJson(json: () => unknown): Context<ApiEnv> {
  return { req: { json } } as unknown as Context<ApiEnv>;
}

describe("readJsonObject", () => {
  it("returns a parsed JSON object", async () => {
    const c = ctxWithJson(async () => ({ a: 1 }));
    expect(await readJsonObject(c)).toEqual({ a: 1 });
  });

  it("throws INVALID_JSON (400) when the body isn't valid JSON", async () => {
    const c = ctxWithJson(() => {
      throw new Error("bad");
    });
    await expect(readJsonObject(c)).rejects.toMatchObject({ code: "INVALID_JSON", status: 400 });
  });

  it.each([
    ["null", async () => null],
    ["a primitive", async () => 7],
    ["an array", async () => [1, 2]],
  ])("throws INVALID_BODY (400) when the body is %s", async (_label, json) => {
    await expect(readJsonObject(ctxWithJson(json))).rejects.toMatchObject({ code: "INVALID_BODY", status: 400 });
  });
});

describe("optionalString / requiredString", () => {
  it("returns the string when present", () => {
    expect(optionalString({ name: "x" }, "name")).toBe("x");
    expect(requiredString({ name: "x" }, "name")).toBe("x");
  });

  it.each([["undefined", {}], ["null", { name: null }], ["empty", { name: "" }]])(
    "optionalString returns null when %s",
    (_l, body) => {
      expect(optionalString(body as Record<string, unknown>, "name")).toBeNull();
    },
  );

  it("optionalString throws INVALID_FIELD (422) for a non-string", () => {
    expect(() => optionalString({ name: 5 }, "name")).toThrowError(/must be a string/);
  });

  it("requiredString throws MISSING_FIELD (422) when absent/empty", () => {
    expect(() => requiredString({}, "name")).toThrowError(/is required/);
  });
});

describe("optionalNumber / requiredNumber", () => {
  it("returns the number when present (including 0)", () => {
    expect(optionalNumber({ n: 0 }, "n")).toBe(0);
    expect(requiredNumber({ n: 3 }, "n")).toBe(3);
  });

  it.each([["undefined", {}], ["null", { n: null }], ["empty", { n: "" }]])(
    "optionalNumber returns null when %s",
    (_l, body) => {
      expect(optionalNumber(body as Record<string, unknown>, "n")).toBeNull();
    },
  );

  it.each([["a string", { n: "5" }], ["NaN", { n: Number.NaN }]])(
    "optionalNumber throws INVALID_FIELD for %s",
    (_l, body) => {
      expect(() => optionalNumber(body as Record<string, unknown>, "n")).toThrowError(/must be a number/);
    },
  );

  it("requiredNumber throws MISSING_FIELD when null", () => {
    expect(() => requiredNumber({ n: null }, "n")).toThrowError(/is required/);
  });
});

describe("optionalBoolean", () => {
  it("returns the boolean when present", () => {
    expect(optionalBoolean({ b: false }, "b")).toBe(false);
    expect(optionalBoolean({ b: true }, "b")).toBe(true);
  });

  it.each([["undefined", {}], ["null", { b: null }], ["empty", { b: "" }]])(
    "returns null when %s",
    (_l, body) => {
      expect(optionalBoolean(body as Record<string, unknown>, "b")).toBeNull();
    },
  );

  it("throws INVALID_FIELD for a non-boolean", () => {
    expect(() => optionalBoolean({ b: "yes" }, "b")).toThrowError(/must be a boolean/);
  });
});
