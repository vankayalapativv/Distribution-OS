"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiRequest, type ActionConfig } from "@/lib/api-client";
import type { BeatPlanResponse, ExecutivesResponse } from "./beat-plans-api";

/** Executive selection, the beat-plan query, the switch shimmer, and the three
 *  optimistic mutations (reorder / remove / assign) for the Beat Plans panel. */
export function useBeatPlans(actionConfig: ActionConfig) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState("");

  const execQuery = useQuery({
    queryKey: ["beat-plans", "executives"],
    queryFn: () => apiGet<ExecutivesResponse>(actionConfig, "/beat-plans/executives"),
  });
  const executives = useMemo(() => execQuery.data?.executives ?? [], [execQuery.data]);
  // The effective executive: the explicit selection, else the first one loaded.
  // Derived (not set in an effect) so there's no cascading render on load.
  const executiveId = selectedId || executives[0]?.id || "";

  const plan = useQuery({
    queryKey: ["beat-plans", executiveId],
    queryFn: () => apiGet<BeatPlanResponse>(actionConfig, `/beat-plans?executiveId=${executiveId}`),
    enabled: Boolean(executiveId),
    // staleTime 0 forces a refetch on every (re)selection so the board reflects the
    // latest saved plan — and so the shimmer always has a real fetch to wait on.
    staleTime: 0,
  });
  const customers = plan.data?.customers ?? [];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["beat-plans", executiveId] });

  // Board shimmer, raised the moment an SE is (re)selected (and on first load), then
  // cleared IN RENDER — not in an effect — once the thing we're waiting on has settled:
  // the plan fetch for the selected SE, or the exec list when there's no SE to plan.
  // Clearing here, guarded by `switching`, converges in one pass and keeps background
  // refetches (window refocus, post-mutation invalidate) from re-flashing the skeleton
  // the way a plain `isFetching` derivation would.
  const [switching, setSwitching] = useState(true);
  if (switching) {
    const settled = executiveId ? plan.isFetched && !plan.isFetching : !execQuery.isLoading;
    if (settled) setSwitching(false);
  }

  // The roster has loaded and there is no executive to plan for at all.
  const noExecutives = !execQuery.isLoading && executives.length === 0;

  // Reorder is optimistic and only reconciles on ERROR (no success refetch avoids a
  // cross-day snap-back race). Remove / assign refetch on success.
  const reorderMut = useMutation({
    mutationFn: (v: { weekday: number; customerIds: string[] }) =>
      apiRequest(actionConfig, "PUT", "/beat-plans/reorder", { executiveId, ...v }),
    onError: invalidate,
  });
  const removeMut = useMutation({
    mutationFn: (customerId: string) => apiRequest(actionConfig, "DELETE", `/beat-plans/assign/${customerId}`),
    onSuccess: invalidate,
  });
  const assignMut = useMutation({
    mutationFn: (v: { customerId: string; weekday: number }) => apiRequest(actionConfig, "PUT", "/beat-plans/assign", v),
    onSuccess: invalidate,
  });

  const selectExecutive = (id: string) => { setSelectedId(id); setSwitching(true); };

  return {
    executiveId, selectExecutive, executives, customers,
    isError: plan.isError, switching, noExecutives,
    reorderMut, removeMut, assignMut,
  };
}

export type BeatPlansState = ReturnType<typeof useBeatPlans>;
