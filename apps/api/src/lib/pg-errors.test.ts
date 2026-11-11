import { describe, expect, it, vi } from "vitest";
import { isUniqueViolation, retryOnUniqueViolation } from "./pg-errors";

describe("isUniqueViolation", () => {
  it("is false for non-objects", () => {
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation("oops")).toBe(false);
  });

  it("detects a unique violation by SQLSTATE code", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });

  it("detects a unique violation by message text", () => {
    expect(isUniqueViolation({ message: "duplicate key value violates ..." })).toBe(true);
    expect(isUniqueViolation({ message: "unique constraint failed" })).toBe(true);
  });

  it("is false when neither code nor message match", () => {
    expect(isUniqueViolation({ code: "23503", message: "fk violation" })).toBe(false);
  });

  it("scopes to a named constraint via constraint / detail / message", () => {
    expect(isUniqueViolation({ code: "23505", constraint: "orders_code_key" }, "orders_code_key")).toBe(true);
    expect(isUniqueViolation({ code: "23505", detail: "Key (code)=... orders_code_key" }, "orders_code_key")).toBe(true);
    expect(isUniqueViolation({ code: "23505", message: "dup on orders_code_key" }, "orders_code_key")).toBe(true);
  });

  it("is false for a unique violation on a different constraint", () => {
    expect(isUniqueViolation({ code: "23505", constraint: "other_key" }, "orders_code_key")).toBe(false);
  });
});

describe("retryOnUniqueViolation", () => {
  it("returns on first success without retrying", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    expect(await retryOnUniqueViolation(fn)).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on a unique violation, then succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce({ code: "23505" })
      .mockResolvedValueOnce("ok");
    expect(await retryOnUniqueViolation(fn)).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("rethrows a non-unique error immediately (no retry)", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("other"));
    await expect(retryOnUniqueViolation(fn)).rejects.toThrow("other");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("gives up after the last attempt and rethrows the unique violation", async () => {
    const fn = vi.fn().mockRejectedValue({ code: "23505" });
    await expect(retryOnUniqueViolation(fn, { attempts: 2 })).rejects.toMatchObject({ code: "23505" });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("clamps attempts to at least 1", async () => {
    const fn = vi.fn().mockRejectedValue({ code: "23505" });
    await expect(retryOnUniqueViolation(fn, { attempts: 0 })).rejects.toMatchObject({ code: "23505" });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
