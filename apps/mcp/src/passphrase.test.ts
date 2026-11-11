import { describe, expect, it } from "vitest";
import { timingSafeStringEqual } from "./passphrase";

describe("timingSafeStringEqual", () => {
  it("is true for equal strings", () => {
    expect(timingSafeStringEqual("secret-123", "secret-123")).toBe(true);
    expect(timingSafeStringEqual("", "")).toBe(true);
  });

  it("is false for different strings (value or length)", () => {
    expect(timingSafeStringEqual("secret", "secreu")).toBe(false);
    expect(timingSafeStringEqual("secret", "secret-longer")).toBe(false);
    expect(timingSafeStringEqual("secret", "")).toBe(false);
  });
});
