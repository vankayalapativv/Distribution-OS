"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getStates, loadDistricts } from "vardhan-maps/data";

const EMPTY: GeoJSON.Feature[] = [];

/** All 36 Indian state / UT boundaries (bundled, low resolution) from
 *  `vardhan-maps`. Each feature carries `properties.name` (the canonical state
 *  name, e.g. "Andhra Pradesh"). Drives the states OVERVIEW tier and the
 *  geometric state assignment — so the heat follows wherever customers actually
 *  are, with no hardcoded state. Computed once (the collection is static). */
export function useAllStates(): GeoJSON.Feature[] {
  return useMemo(() => getStates() as unknown as GeoJSON.Feature[], []);
}

/** The districts of ONE state, lazily loaded from its own code-split chunk and
 *  cached for the session. Returns an empty array until a state is selected and
 *  its chunk resolves — so the map renders the state outline first, then the
 *  district layer appears. `properties.name` = district name. */
export function useStateDistricts(stateName: string | null): GeoJSON.Feature[] {
  const { data } = useQuery({
    queryKey: ["state-districts", stateName],
    queryFn: async () =>
      (await loadDistricts(stateName as string)) as unknown as GeoJSON.Feature[],
    enabled: Boolean(stateName),
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return data ?? EMPTY;
}
