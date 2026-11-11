"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiGet, type ActionConfig } from "@/lib/api-client";
import type { DuesSummary } from "./dues-helpers";

export interface DuesFilterOptions {
  cities: string[];
  salesExecutives: { id: string; name: string }[];
}

/** The Collection Dues card's data: filter options (cities scoped to the chosen
 *  executive) + the aging summary for the current executive/city filter. */
export function useDuesData(actionConfig: ActionConfig, executiveId: string, city: string) {
  const options = useQuery({
    queryKey: ["customer-filter-options", executiveId],
    queryFn: () =>
      apiGet<DuesFilterOptions>(
        actionConfig,
        `/customers/filter-options${executiveId ? `?executiveId=${executiveId}` : ""}`,
      ),
    placeholderData: keepPreviousData,
    staleTime: 600_000,
  });

  const summary = useQuery({
    queryKey: ["dues-summary", executiveId, city],
    queryFn: () => {
      const params = new URLSearchParams();
      if (executiveId) params.set("executiveId", executiveId);
      if (city) params.set("city", city);
      const qs = params.toString();
      return apiGet<DuesSummary>(actionConfig, `/dues/summary${qs ? `?${qs}` : ""}`);
    },
    placeholderData: keepPreviousData,
    staleTime: 300_000,
  });

  return {
    cities: options.data?.cities ?? [],
    salesExecutives: options.data?.salesExecutives ?? [],
    summary,
  };
}
