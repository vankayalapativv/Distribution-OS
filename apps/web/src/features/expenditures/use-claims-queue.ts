"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import type { ExpenseClaim } from "./expense-claims-api";

/** The office claims review queue: pending claims + approve/reject, which both
 *  refresh the ledger + summary (an approved claim books into them). */
export function useClaimsQueue(actionConfig: ActionConfig) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["expense-claims", "submitted"],
    queryFn: () => apiGet<ExpenseClaim[]>(actionConfig, "/expense-claims?status=submitted"),
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["expense-claims"] });
    void queryClient.invalidateQueries({ queryKey: ["expenditures"] });
    void queryClient.invalidateQueries({ queryKey: ["expenditure-summary"] });
  }

  async function approve(id: string, approvedAmount: number | null): Promise<void> {
    try {
      await apiRequest(actionConfig, "POST", `/expense-claims/${id}/approve`, approvedAmount != null ? { approvedAmount } : {});
    } catch (e) {
      throw new Error(errorMessage(e, "Could not approve the claim."));
    }
    await refresh();
  }

  async function reject(id: string, reason: string): Promise<void> {
    try {
      await apiRequest(actionConfig, "POST", `/expense-claims/${id}/reject`, { reason });
    } catch (e) {
      throw new Error(errorMessage(e, "Could not reject the claim."));
    }
    await refresh();
  }

  return { claims: query.data ?? [], isLoading: query.isLoading, approve, reject };
}
