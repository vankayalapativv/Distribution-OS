"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addMonths, addWeeks, format, startOfMonth, startOfWeek, subMonths, subWeeks } from "date-fns";
import { apiGet, apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import type { ExecutiveTargets, TargetPeriod, TargetsResponse, TargetValues } from "./targets-api";
import { currentStartOf, MONDAY, periodLabel, targetOf } from "./targets-period";

/** All state, derived flags, navigation, query + "apply to all" for the Targets panel. */
export function useTargetsPanel(actionConfig: ActionConfig) {
  const [period, setPeriod] = useState<TargetPeriod>("week");
  const [selectedStart, setSelectedStart] = useState<Date>(() => currentStartOf("week"));
  const [editing, setEditing] = useState<ExecutiveTargets | null>(null);
  // In-app clipboard: Copy in any dialog → Paste into another exec/period, or
  // "Paste to all" for the whole period. Survives period switches (panel state).
  const [clipboard, setClipboard] = useState<TargetValues | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const queryClient = useQueryClient();

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

  const applyAll = useMutation({
    mutationFn: async (vals: TargetValues) => {
      await Promise.all(
        executives.map((exec) =>
          apiRequest(actionConfig, "PUT", `/targets/${exec.userId}`, {
            periodType: period, periodDate: startStr, segments: vals.oil,
          }),
        ),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["se-targets"] });
      setConfirmAll(false);
    },
    onError: (e) => setBulkError(errorMessage(e, "Could not apply to all executives.")),
  });

  function copyRow(exec: ExecutiveTargets) {
    setClipboard(targetOf(exec));
    setCopiedId(exec.userId);
    window.setTimeout(() => setCopiedId((id) => (id === exec.userId ? null : id)), 1500);
  }
  const changePeriod = (p: TargetPeriod) => { setPeriod(p); setSelectedStart(currentStartOf(p)); };
  const shift = (d: Date, dir: -1 | 1): Date => {
    if (period === "week") return dir > 0 ? addWeeks(d, 1) : subWeeks(d, 1);
    return dir > 0 ? addMonths(d, 1) : subMonths(d, 1);
  };
  const step = (dir: -1 | 1) => setSelectedStart((d) => shift(d, dir));
  const jumpTo = (date: Date) => setSelectedStart(period === "week" ? startOfWeek(date, MONDAY) : startOfMonth(date));

  return {
    period, selectedStart, editing, setEditing, clipboard, setClipboard, confirmAll, setConfirmAll,
    bulkError, setBulkError, copiedId, currentStart, startStr, isFuture, isPast, isCurrent,
    canEdit: !isPast, label: periodLabel(period, selectedStart), query, executives, applyAll,
    copyRow, changePeriod, step, jumpTo, goToCurrent: () => setSelectedStart(currentStart),
  };
}

export type TargetsPanelState = ReturnType<typeof useTargetsPanel>;
