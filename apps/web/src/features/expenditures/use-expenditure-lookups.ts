"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet, type ActionConfig } from "@/lib/api-client";
import type { ExpenditureCategory } from "./expenditures-api";

/** The category + people dropdowns for the Expenditure form, cached by React Query. */
export function useExpenditureLookups(actionConfig: ActionConfig) {
  const categoriesQuery = useQuery({
    queryKey: ["expenditure-categories"],
    queryFn: () => apiGet<{ categories: ExpenditureCategory[] }>(actionConfig, "/expenditures/categories"),
  });
  const peopleQuery = useQuery({
    queryKey: ["expenditure-people"],
    queryFn: () => apiGet<{ people: { id: string; name: string }[] }>(actionConfig, "/expenditures/people"),
  });
  return {
    categories: categoriesQuery.data?.categories ?? [],
    people: peopleQuery.data?.people ?? [],
  };
}
