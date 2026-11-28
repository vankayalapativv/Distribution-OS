"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet, type ActionConfig } from "@/lib/api-client";
import type { EmployeeLedger } from "./employee-ledger-api";

/** One person's combined expense ledger; idle until a person is picked. */
export function useEmployeeLedger(actionConfig: ActionConfig, userId: string | null) {
  const query = useQuery({
    queryKey: ["employee-ledger", userId],
    queryFn: () => apiGet<EmployeeLedger>(actionConfig, `/expenditures/ledger?userId=${userId}`),
    enabled: !!userId,
  });
  return { ledger: query.data ?? null, isLoading: !!userId && query.isLoading };
}
