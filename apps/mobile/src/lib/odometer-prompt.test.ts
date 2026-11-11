import { describe, expect, it, vi } from "vitest";
import { promptOdometer } from "./odometer-prompt";

/** Builds a dialog whose prompt returns the given values in order. */
function fakeDialog(values: (string | null)[]) {
  const prompt = vi.fn();
  for (const v of values) prompt.mockResolvedValueOnce(v);
  const confirm = vi.fn().mockResolvedValue(true); // the "OK" on a validation notice
  return { prompt, confirm };
}

describe("promptOdometer", () => {
  it("accepts a valid whole number", async () => {
    const d = fakeDialog(["45200"]);
    expect(await promptOdometer(d, { title: "", message: "" })).toBe(45200);
    expect(d.confirm).not.toHaveBeenCalled();
  });

  it("returns null when cancelled", async () => {
    const d = fakeDialog([null]);
    expect(await promptOdometer(d, { title: "", message: "" })).toBeNull();
  });

  it("re-asks on a non-integer, then accepts", async () => {
    const d = fakeDialog(["45.5", "45300"]);
    expect(await promptOdometer(d, { title: "", message: "" })).toBe(45300);
    expect(d.confirm).toHaveBeenCalledTimes(1); // one "invalid" notice
  });

  it("rejects an end reading EQUAL to the start (must be strictly higher)", async () => {
    const d = fakeDialog(["45200", "45201"]);
    const result = await promptOdometer(d, { title: "", message: "", greaterThan: 45200 });
    expect(result).toBe(45201);
    expect(d.confirm).toHaveBeenCalledTimes(1); // the "too low" notice for 45200
  });

  it("rejects an end reading BELOW the start, then accepts a higher one", async () => {
    const d = fakeDialog(["45000", "45300"]);
    expect(await promptOdometer(d, { title: "", message: "", greaterThan: 45200 })).toBe(45300);
    expect(d.confirm).toHaveBeenCalledTimes(1);
  });

  const bounds = { title: "", message: "", greaterThan: 45200, minDistanceKm: 10, maxDistanceKm: 200 };

  it("rejects a day distance below the minimum (the 0→1 gaming), then accepts", async () => {
    const d = fakeDialog(["45205", "45210"]); // 5 km (reject) → 10 km (accept)
    expect(await promptOdometer(d, bounds)).toBe(45210);
    expect(d.confirm).toHaveBeenCalledTimes(1);
  });

  it("rejects a day distance above the maximum (e.g. a 1→1300 typo), then accepts", async () => {
    const d = fakeDialog(["45500", "45300"]); // 300 km (reject) → 100 km (accept)
    expect(await promptOdometer(d, bounds)).toBe(45300);
    expect(d.confirm).toHaveBeenCalledTimes(1);
  });

  it("accepts the exact min (10 km) and max (200 km) boundaries", async () => {
    expect(await promptOdometer(fakeDialog(["45210"]), bounds)).toBe(45210); // exactly 10 km
    expect(await promptOdometer(fakeDialog(["45400"]), bounds)).toBe(45400); // exactly 200 km
  });
});
