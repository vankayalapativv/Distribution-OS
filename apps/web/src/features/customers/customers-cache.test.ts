import { describe, expect, it } from "vitest";
import { cacheCustomer, getCachedCustomer } from "./customers-cache";
import type { Customer } from "./customers-api";

describe("customers-cache", () => {
  it("caches a customer by id and reads it back; misses are undefined", () => {
    const c = { id: "c1", legalName: "Ravi Motors" } as unknown as Customer;
    cacheCustomer(c);
    expect(getCachedCustomer("c1")).toBe(c);
    expect(getCachedCustomer("nope")).toBeUndefined();
  });

  it("ignores a customer with no id (the guard's false branch)", () => {
    cacheCustomer({ id: "" } as unknown as Customer);
    expect(getCachedCustomer("")).toBeUndefined();
  });
});
