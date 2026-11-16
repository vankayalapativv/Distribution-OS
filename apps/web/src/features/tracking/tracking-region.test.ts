import { describe, expect, it } from "vitest";
import { operatingStatesOf } from "./tracking-region";
import type { MapCustomer } from "@/features/dashboard/map/map-helpers";
import type { RoutePoint, TrackedExecutive } from "./tracking-api";

const feat = (name: string, props: Record<string, unknown>, box: [number, number, number, number]) =>
  ({
    type: "Feature",
    properties: { name, ...props },
    geometry: {
      type: "Polygon",
      coordinates: [[[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]], [box[0], box[1]]]],
    },
  }) as unknown as GeoJSON.Feature;

// Two state boxes: "A" (lng 77–80), "B" (lng 80–83).
const states = [feat("A", { code: "IN-A" }, [77, 15, 80, 20]), feat("B", { code: "IN-B" }, [80, 15, 83, 20])];
const cust = (lat: number, lng: number): MapCustomer =>
  ({ id: "c", name: "", code: "", city: null, lat, lng, executiveId: null, executiveName: null, outstanding: 0, ageDays: null, bucket: null, lastOrderDays: null, lastCollectionDays: null, active: true });
const exec = (lat: number | null, lng: number | null): TrackedExecutive =>
  ({ userId: "u", name: "", lastLatitude: lat, lastLongitude: lng, trackingStatus: "fresh" } as unknown as TrackedExecutive);

describe("operatingStatesOf", () => {
  it("unions the states of customers, executive positions and route points (deduped)", () => {
    const customers = [cust(17, 78), cust(17, 78.5)]; // both in A
    const execs = [exec(17, 81)]; // in B
    const route: RoutePoint[] = [{ latitude: 17, longitude: 82, accuracyMeters: 5, recordedAt: "" }]; // B
    expect(operatingStatesOf(states, customers, execs, route).sort()).toEqual(["A", "B"]);
  });

  it("ignores points outside every state and executives without coordinates", () => {
    expect(operatingStatesOf(states, [cust(0, 0)], [exec(null, null)], [])).toEqual([]);
  });
});
