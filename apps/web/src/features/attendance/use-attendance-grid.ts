"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import type { AttendanceGridResponse, AttendanceStatus } from "./attendance-api";
import { todayYmd } from "./attendance-format";
import { monthDays, weekdayInfo } from "./attendance-grid-utils";
import type { EditTarget } from "./attendance-cell-dialog";

/** Grid state for a given (controlled) month: the month query, the edit target, and save/clear. */
export function useAttendanceGrid(actionConfig: ActionConfig, month: string) {
  const today = todayYmd();
  const queryClient = useQueryClient();
  const queryKey = ["attendance-grid", month];

  const query = useQuery({
    queryKey,
    queryFn: () => apiGet<AttendanceGridResponse>(actionConfig, `/attendance/grid?month=${month}`),
  });

  const [edit, setEdit] = useState<EditTarget | null>(null);

  // Fall back to the month's calendar days while loading, so the grid shell —
  // day headers + the context-aware shimmer rows — shows the right columns at once.
  const days = useMemo(() => query.data?.days ?? monthDays(month), [query.data, month]);
  const rows = query.data?.rows ?? [];
  const dayMeta = useMemo(() => days.map((d) => ({ d, day: Number(d.slice(8)), ...weekdayInfo(d) })), [days]);

  const onDone = () => {
    void queryClient.invalidateQueries({ queryKey });
    setEdit(null);
  };

  const save = useMutation({
    mutationFn: (v: { userId: string; date: string; status: AttendanceStatus; note: string }) =>
      apiRequest(actionConfig, "PUT", "/attendance", v),
    onSuccess: onDone,
  });

  const clear = useMutation({
    mutationFn: (v: { userId: string; date: string }) =>
      apiRequest(actionConfig, "DELETE", `/attendance?userId=${v.userId}&date=${v.date}`),
    onSuccess: onDone,
  });

  // Mark the whole date a holiday for every active SE (a company-wide holiday).
  const holidayAll = useMutation({
    mutationFn: (v: { date: string; note: string }) =>
      apiRequest(actionConfig, "POST", "/attendance/holiday-all", v),
    onSuccess: onDone,
  });

  return {
    today,
    isLoading: query.isLoading,
    days,
    rows,
    dayMeta,
    edit,
    setEdit,
    saveCell: (status: AttendanceStatus, note: string) =>
      edit && save.mutate({ userId: edit.userId, date: edit.cell.date, status, note }),
    clearCell: () => edit && clear.mutate({ userId: edit.userId, date: edit.cell.date }),
    holidayAllForDate: (note: string) =>
      edit && holidayAll.mutate({ date: edit.cell.date, note }),
    saving: save.isPending || clear.isPending || holidayAll.isPending,
    error: errorMessage(save.error ?? clear.error ?? holidayAll.error, "") || null,
  };
}
