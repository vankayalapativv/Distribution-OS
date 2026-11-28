import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { useAuth } from "./auth";
import { fetchMyReimbursements, type MyReimbursements } from "./reimbursements";

/** The "company owes you" total for the My expenses screen. Online-only; refetches
 *  on focus so it reflects the office approving/paying (both change the total). */
export function useMyReimbursements() {
  const token = useAuth((s) => s.token);
  const query = useQuery<MyReimbursements>({
    queryKey: ["my-reimbursements"],
    queryFn: () => fetchMyReimbursements(token),
    enabled: Boolean(token),
    staleTime: 0,
  });
  const refetch = query.refetch;
  useFocusEffect(useCallback(() => { void refetch(); }, [refetch]));
  return { owedTotal: query.data?.owedTotal ?? 0, refetch };
}
