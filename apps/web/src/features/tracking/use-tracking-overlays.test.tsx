import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data: Record<string, any> = {
  "tracking-customer-map": { customers: [{ lat: 17.2, lng: 80 }, { lat: 17.3, lng: 80 }, { lat: 16, lng: 79 }] },
  "tracking-device-health": { devices: [{ userId: "u1" }] },
};
vi.mock("@tanstack/react-query", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useQuery: ({ queryKey }: { queryKey: any[] }) => ({ data: data[queryKey[0]] }),
}));
vi.mock("@/features/dashboard/map/district-helpers", () => ({
  districtOf: (_features: unknown, _lng: number, lat: number) => (lat > 17 ? "Nalgonda" : null),
}));

import { useTrackingOverlays } from "./use-tracking-overlays";

const config = { apiBaseUrl: "", authToken: "" };

describe("useTrackingOverlays", () => {
  it("returns customers and the unique districts they fall in", () => {
    const { result } = renderHook(() => useTrackingOverlays(config, "2026-09-14", "map", true));
    expect(result.current.customers).toHaveLength(3);
    expect(result.current.customerDistricts).toEqual(["Nalgonda"]); // deduped; the 16°-lat customer maps to no district
  });

  it("exposes the device-health roster", () => {
    const { result } = renderHook(() => useTrackingOverlays(config, "2026-09-14", "health", true));
    expect(result.current.deviceHealth).toEqual([{ userId: "u1" }]);
  });

  it("defaults to empty customers/devices when the queries have no data", () => {
    const saved = { ...data };
    data["tracking-customer-map"] = undefined;
    data["tracking-device-health"] = undefined;
    const { result } = renderHook(() => useTrackingOverlays(config, "2026-09-14", "health", true));
    expect(result.current.customers).toEqual([]);
    expect(result.current.customerDistricts).toEqual([]);
    expect(result.current.deviceHealth).toEqual([]);
    Object.assign(data, saved);
  });
});
