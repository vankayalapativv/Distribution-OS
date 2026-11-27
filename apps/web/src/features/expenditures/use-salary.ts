"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import type { SalaryRow, Staff } from "./salary-api";

/** Office salary: the per-person table + staff picker + set/pay actions. Paying
 *  touches the ledger + advances, so it refreshes those too. */
export function useSalary(actionConfig: ActionConfig) {
  const queryClient = useQueryClient();
  const rows = useQuery({ queryKey: ["salaries"], queryFn: () => apiGet<SalaryRow[]>(actionConfig, "/salary") });
  const staff = useQuery({ queryKey: ["salary-staff"], queryFn: () => apiGet<Staff[]>(actionConfig, "/salary/staff") });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["salaries"] });
    void queryClient.invalidateQueries({ queryKey: ["expenditures"] });
    void queryClient.invalidateQueries({ queryKey: ["expenditure-summary"] });
    void queryClient.invalidateQueries({ queryKey: ["advances"] });
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
    rows: rows.data ?? [],
    staff: staff.data ?? [],
    isLoading: rows.isLoading,
    setSalary: (userId: string, amount: number, effectiveFrom: string | null) =>
      run(() => apiRequest(actionConfig, "POST", "/salary/set", { userId, amount, effectiveFrom }), "Could not save the salary."),
    paySalary: (userId: string, periodMonth: string, paymentMode: string) =>
      run(() => apiRequest(actionConfig, "POST", "/salary/pay", { userId, periodMonth, paymentMode }), "Could not pay the salary."),
  };
}
