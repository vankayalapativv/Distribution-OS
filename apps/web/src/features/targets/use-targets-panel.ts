"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addMonths, addWeeks, format, startOfMonth, startOfWeek, subMonths, subWeeks } from "date-fns";
import { useCan } from "@/features/shell/use-can";
import { apiGet, type ActionConfig } from "@/lib/api-client";
import type { ExecutiveTargets, TargetPeriod, TargetsResponse } from "./targets-api";
import { currentStartOf, MONDAY, periodLabel } from "./targets-period";

/** All state, derived flags, navigation and the query for the Targets panel. */
export function useTargetsPanel(actionConfig: ActionConfig) {
  const canEditTargets = useCan("action:targets.edit");
  const [period, setPeriod] = useState<TargetPeriod>("week");
  const [selectedStart, setSelectedStart] = useState<Date>(() => currentStartOf("week"));
  const [editing, setEditing] = useState<ExecutiveTargets | null>(null);

  const currentStart = currentStartOf(period);
  const startStr = format(selectedStart, "yyyy-MM-dd");
  const isFuture = selectedStart.getTime() > currentStart.getTime();
  const isPast = selectedStart.getTime() < currentStart.getTime();
  const isCurrent = !isFuture && !isPast;

  const query = useQuery({
    queryKey: ["se-targets", period, startStr],
    queryFn: () => apiGet<TargetsResponse>(actionConfig, `/targets?periodType=${period}&periodStart=${startStr}`),
    refetchInterval: 120_000,
  });
  const executives = query.data?.executives ?? [];

  const changePeriod = (p: TargetPeriod) => { setPeriod(p); setSelectedStart(currentStartOf(p)); };
  const shift = (d: Date, dir: -1 | 1): Date => {
    if (period === "week") return dir > 0 ? addWeeks(d, 1) : subWeeks(d, 1);
    return dir > 0 ? addMonths(d, 1) : subMonths(d, 1);
  };
  const step = (dir: -1 | 1) => setSelectedStart((d) => shift(d, dir));
  const jumpTo = (date: Date) => setSelectedStart(period === "week" ? startOfWeek(date, MONDAY) : startOfMonth(date));

  return {
    period, selectedStart, editing, setEditing, currentStart, startStr, isFuture, isPast, isCurrent,
    // Editable only for a non-past period AND when the role holds targets.edit.
    canEdit: !isPast && canEditTargets, label: periodLabel(period, selectedStart), query, executives,
    changePeriod, step, jumpTo, goToCurrent: () => setSelectedStart(currentStart),
  };
}

export type TargetsPanelState = ReturnType<typeof useTargetsPanel>;
