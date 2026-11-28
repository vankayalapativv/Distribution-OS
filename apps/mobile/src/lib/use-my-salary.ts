import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { useAuth } from "./auth";
import { fetchMySalary, type MyPay } from "./salary";

/** The SE's own pay (salary + this month's net) for the My expenses screen.
 *  Online-only; refetches on focus so a just-paid salary shows up. */
export function useMySalary() {
  const token = useAuth((s) => s.token);
  const query = useQuery<MyPay>({
    queryKey: ["my-salary"],
    queryFn: () => fetchMySalary(token),
    enabled: Boolean(token),
    staleTime: 0,
  });
  const refetch = query.refetch;
  useFocusEffect(useCallback(() => { void refetch(); }, [refetch]));
  return { pay: query.data ?? null, refetch };
}
