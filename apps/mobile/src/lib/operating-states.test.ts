import { describe, expect, it } from "vitest";
import { operatingStatesOf } from "./operating-states";

// Validates the real bundled `vardhan-maps` state geometry + point-in-polygon:
// coordinates anywhere in India resolve to the right state (no hard-coded region).
describe("operatingStatesOf", () => {
  it("maps coordinates to their Indian state (India-wide, deduped)", () => {
    const states = operatingStatesOf([
      { lat: 17.385, lng: 78.4867 }, // Hyderabad
      { lat: 17.44, lng: 78.39 }, // also Telangana → deduped
      { lat: 19.076, lng: 72.877 }, // Mumbai
      { lat: 28.61, lng: 77.23 }, // Delhi
    ]);
    expect(states.sort()).toEqual(["Delhi", "Maharashtra", "Telangana"]);
  });

  it("ignores points outside India and non-finite coords", () => {
    expect(operatingStatesOf([])).toEqual([]);
    expect(
      operatingStatesOf([
        { lat: 0, lng: 0 }, // Gulf of Guinea — outside India
        { lat: Number.NaN, lng: 78 },
      ]),
    ).toEqual([]);
  });
});
