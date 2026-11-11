"use client";

import { useQuery } from "@tanstack/react-query";
import { loadDistricts } from "vardhan-maps/data";

const EMPTY: GeoJSON.Feature[] = [];

/** Loads ALL Telangana district boundaries from `vardhan-maps` (government-aligned
 *  OSM GeoJSON, code-split per state, fetched lazily and cached once for the whole
 *  session). Each feature carries `properties.name` (the district). Returns an
 *  empty array until the chunk resolves — so the map renders its basemap/mask
 *  first, then the district layer appears once the data is in.
 *
 *  This replaces the old hardcoded four-district (Greater Hyderabad) set for the
 *  dashboard Customers Map, so the heat overlay follows wherever customers are. */
export function useTelanganaDistricts(): GeoJSON.Feature[] {
  const { data } = useQuery({
    queryKey: ["telangana-districts"],
    queryFn: async () =>
      (await loadDistricts("Telangana")) as unknown as GeoJSON.Feature[],
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return data ?? EMPTY;
}
