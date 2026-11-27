import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { useAuth } from "./auth";
import { fetchMyAdvances, type MyAdvances } from "./advances";

/** The SE's outstanding-advance total for the My expenses screen. Online-only;
 *  refetches on focus so it reflects the office approving/recovering. */
export function useMyAdvances() {
  const token = useAuth((s) => s.token);
  const query = useQuery<MyAdvances>({
    queryKey: ["my-advances"],
    queryFn: () => fetchMyAdvances(token),
    enabled: Boolean(token),
    staleTime: 0,
  });
  const refetch = query.refetch;
  useFocusEffect(useCallback(() => { void refetch(); }, [refetch]));
  return { outstandingTotal: query.data?.outstandingTotal ?? 0 };
}
