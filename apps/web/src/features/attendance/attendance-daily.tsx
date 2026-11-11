"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarOff, Clock, MapPin, Route, UserX } from "lucide-react";
import { apiGet, type ActionConfig } from "@/lib/api-client";
import type { DailyAttendanceResponse } from "./attendance-api";
import { km, todayYmd } from "./attendance-format";
import { weekdayInfo } from "./attendance-grid-utils";
import { AttendanceDailyTimeline } from "./attendance-daily-timeline";
import { KpiRow, type KpiItem } from "./attendance-kpis";
import { dailyKpis } from "./attendance-stats";

/** Daily attendance: headline KPIs and the field timeline. The date is driven by the view. */
export function AttendanceDaily({ actionConfig, date }: Readonly<{ actionConfig: ActionConfig; date: string }>) {
  const query = useQuery({
    queryKey: ["attendance-daily", date],
    queryFn: () => apiGet<DailyAttendanceResponse>(actionConfig, `/attendance/daily?date=${date}`),
  });

  const rows = query.data?.rows ?? [];
  const sunday = weekdayInfo(date).sunday;
  const k = dailyKpis(rows, sunday);
  const isToday = date === todayYmd();

  const items: KpiItem[] = [
    {
      label: "Checked in",
      tone: "bg-green-100 text-green-700",
      icon: <MapPin />,
      value: `${k.present}/${k.totalSe}`,
      sub: "started their day",
    },
    sunday
      ? {
          label: "Week off",
          tone: "bg-slate-100 text-slate-600",
          icon: <CalendarOff />,
          value: `${k.weekOff}`,
          sub: "Sunday — weekly off",
        }
      : {
          label: "Absent",
          tone: "bg-red-100 text-red-700",
          icon: <UserX />,
          value: `${k.absent}`,
          sub: "no start-day ping",
        },
    {
      label: isToday ? "On field now" : "Didn't end day",
      tone: "bg-primary/10 text-primary",
      icon: <Clock />,
      value: `${k.onFieldNow}`,
      sub: isToday ? "not yet ended" : "no End-day tap",
    },
    {
      label: "Distance",
      tone: "bg-indigo-100 text-indigo-700",
      icon: <Route />,
      value: k.totalKm > 0 ? km(k.totalKm) : "—",
      sub: `across ${k.present} SEs`,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <KpiRow items={items} isLoading={query.isLoading} />
      <AttendanceDailyTimeline rows={rows} isLoading={query.isLoading} isError={query.isError} sunday={sunday} />
    </div>
  );
}
