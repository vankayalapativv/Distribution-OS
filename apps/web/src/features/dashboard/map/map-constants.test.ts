import { describe, expect, it } from "vitest";
import { BUCKET_ORDER, HYDERABAD, REGION_BOUNDS, REGION_MIN_ZOOM } from "./map-constants";

describe("map constants", () => {
  it("centre on Hyderabad and lock to the Telangana region", () => {
    expect(HYDERABAD).toEqual([17.385, 78.4867]);
    expect(REGION_BOUNDS[0][0]).toBeLessThan(REGION_BOUNDS[1][0]); // SW lat < NE lat
    expect(REGION_MIN_ZOOM).toBe(6);
  });
  it("orders the ageing buckets oldest-last", () => {
    expect(BUCKET_ORDER).toEqual(["0_30", "30_45", "45_60", "60_plus"]);
  });
});
