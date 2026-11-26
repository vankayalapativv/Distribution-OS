import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAutoClearCustomerErrors } from "./use-new-customer-errors";
import type { NewCustomerFields } from "./new-customer";

const computeCustomerErrors = vi.fn<(...a: unknown[]) => Record<string, string>>(() => ({}));
vi.mock("./new-customer-validation", () => ({ computeCustomerErrors: (...a: unknown[]) => computeCustomerErrors(...a) }));

const v = { legalName: "X" } as unknown as NewCustomerFields;
afterEach(() => vi.clearAllMocks());

function run(fresh: Record<string, string>) {
  computeCustomerErrors.mockReturnValue(fresh);
  const setFieldErrors = vi.fn();
  renderHook(() => useAutoClearCustomerErrors(v, false, 0, null, setFieldErrors));
  return setFieldErrors.mock.calls[0][0] as (p: Record<string, string>) => Record<string, string>;
}

describe("useAutoClearCustomerErrors", () => {
  it("no-ops (returns the same object) when no errors are shown", () => {
    const updater = run({ street: "req" });
    const prev = {};
    expect(updater(prev)).toBe(prev);
    expect(computeCustomerErrors).not.toHaveBeenCalled(); // short-circuits before recompute
  });

  it("keeps prev when every shown error still fails (same key count)", () => {
    const updater = run({ street: "req", city: "req" });
    const prev = { street: "req", city: "req" };
    expect(updater(prev)).toBe(prev);
  });

  it("drops the errors the SE has fixed", () => {
    const updater = run({ city: "req" }); // street now valid, city still failing
    expect(updater({ street: "req", city: "req" })).toEqual({ city: "req" });
  });

  it("passes geo != null through to the validator", () => {
    const setFieldErrors = vi.fn();
    computeCustomerErrors.mockReturnValue({ x: "e" });
    renderHook(() => useAutoClearCustomerErrors(v, true, 2, { latitude: 1, longitude: 2 }, setFieldErrors));
    (setFieldErrors.mock.calls[0][0] as (p: Record<string, string>) => unknown)({ x: "e" });
    expect(computeCustomerErrors).toHaveBeenCalledWith(v, true, 2, true);
  });
});
