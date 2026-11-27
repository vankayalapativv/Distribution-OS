"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import type { Advance, AdvanceBalance, RecoveryPlanInput } from "./advances-api";

/** Office advances: pending requests, outstanding balances, and the write actions
 *  (approve / reject / record a direct advance). */
export function useAdvances(actionConfig: ActionConfig) {
  const queryClient = useQueryClient();
  const requests = useQuery({
    queryKey: ["advances", "requested"],
    queryFn: () => apiGet<Advance[]>(actionConfig, "/advances?status=requested"),
  });
  const balances = useQuery({
    queryKey: ["advance-balances"],
    queryFn: () => apiGet<AdvanceBalance[]>(actionConfig, "/advances/balances"),
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["advances"] });
    void queryClient.invalidateQueries({ queryKey: ["advance-balances"] });
  }
  const run = async (fn: () => Promise<unknown>, fallback: string) => {
    try {
      await fn();
    } catch (e) {
      throw new Error(errorMessage(e, fallback));
    }
    await refresh();
  };

  return {
    requests: requests.data ?? [],
    balances: balances.data ?? [],
    outstandingTotal: (balances.data ?? []).reduce((acc, b) => acc + b.outstanding, 0),
    isLoading: requests.isLoading || balances.isLoading,
    approve: (id: string, plan: RecoveryPlanInput) =>
      run(() => apiRequest(actionConfig, "POST", `/advances/${id}/approve`, { ...plan }), "Could not approve the advance."),
    reject: (id: string, reason: string) =>
      run(() => apiRequest(actionConfig, "POST", `/advances/${id}/reject`, { reason }), "Could not reject the advance."),
    record: (input: { userId: string; amount: number; reason: string | null } & RecoveryPlanInput) =>
      run(() => apiRequest(actionConfig, "POST", "/advances/record", { ...input }), "Could not record the advance."),
  };
}
