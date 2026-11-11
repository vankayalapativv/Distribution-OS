import { describe, expect, it } from "vitest";
import { hasErrors, normalizeVehicle, validateEndForm, validateStartForm } from "./delivery-validation";

describe("normalizeVehicle", () => {
  it("uppercases and strips whitespace", () => {
    expect(normalizeVehicle("  ts09 ab 1234 ")).toBe("TS09AB1234");
  });
});

describe("validateStartForm", () => {
  const ok = { vehicle: "TS09AB1234", odo: "48210", hasPhoto: true };
  it("passes a complete valid form", () => {
    expect(validateStartForm(ok)).toEqual({});
    expect(hasErrors(validateStartForm(ok))).toBe(false);
  });
  it("requires a vehicle number", () => {
    expect(validateStartForm({ ...ok, vehicle: "" }).vehicle).toMatch(/required/i);
  });
  it("rejects a malformed plate", () => {
    expect(validateStartForm({ ...ok, vehicle: "ABC" }).vehicle).toMatch(/valid vehicle/i);
  });
  it("requires a positive numeric meter reading", () => {
    expect(validateStartForm({ ...ok, odo: "" }).odo).toMatch(/required/i);
    expect(validateStartForm({ ...ok, odo: "0" }).odo).toMatch(/valid meter/i);
    expect(validateStartForm({ ...ok, odo: "abc" }).odo).toMatch(/valid meter/i);
  });
  it("requires a photo", () => {
    expect(validateStartForm({ ...ok, hasPhoto: false }).photo).toMatch(/photo/i);
  });
});

describe("validateEndForm", () => {
  const ok = { endOdo: "48297", hasPhoto: true, startOdometer: 48210 };
  it("passes a complete valid form", () => {
    expect(validateEndForm(ok)).toEqual({});
  });
  it("rejects an end reading below the start", () => {
    expect(validateEndForm({ ...ok, endOdo: "48000" }).odo).toMatch(/same or more/i);
  });
  it("allows end equal to start", () => {
    expect(validateEndForm({ ...ok, endOdo: "48210" })).toEqual({});
  });
  it("skips the start comparison when startOdometer is null", () => {
    expect(validateEndForm({ endOdo: "5", hasPhoto: true, startOdometer: null })).toEqual({});
  });
  it("requires a photo", () => {
    expect(validateEndForm({ ...ok, hasPhoto: false }).photo).toMatch(/photo/i);
  });
});
