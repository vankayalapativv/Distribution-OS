"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import type { ReimbursementPayable } from "./reimbursements-api";

/** The office settle queue: still-owed reimbursements + mark-paid. */
export function useReimbursements(actionConfig: ActionConfig) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["reimbursements", "owed"],
    queryFn: () => apiGet<ReimbursementPayable[]>(actionConfig, "/reimbursements?status=owed"),
  });

  async function markPaid(id: string, paymentMode: string | null): Promise<void> {
    try {
      await apiRequest(actionConfig, "POST", `/reimbursements/${id}/pay`, paymentMode ? { paymentMode } : {});
    } catch (e) {
      throw new Error(errorMessage(e, "Could not mark it paid."));
    }
    await queryClient.invalidateQueries({ queryKey: ["reimbursements"] });
  }

  const owed = query.data ?? [];
  return {
    owed,
    total: owed.reduce((acc, p) => acc + p.amount, 0),
    peopleCount: new Set(owed.map((p) => p.userId)).size,
    isLoading: query.isLoading,
    markPaid,
  };
}
