"use client";

import { Clock, Route, UserCheck, Users } from "lucide-react";
import type { ActionConfig } from "@/lib/api-client";
import type { DashboardRole } from "@/features/shell/dashboard-nav";
import { CellEditDialog } from "./attendance-cell-dialog";
import { StatusLegend } from "./attendance-controls";
import { fmtDays, hoursLabel, km } from "./attendance-format";
import { AttendanceGridTable } from "./attendance-grid-table";
import { KpiRow, type KpiItem } from "./attendance-kpis";
import { gridKpis } from "./attendance-stats";
import { useAttendanceGrid } from "./use-attendance-grid";

/** Monthly attendance: KPI tiles → legend → the matrix (SA can override). Month is driven by the view. */
export function AttendanceGrid({
  actionConfig,
  role,
  month,
}: Readonly<{
  actionConfig: ActionConfig;
  role: DashboardRole;
  month: string;
}>) {
  const canEdit = role === "SUPER_ADMIN";
  const g = useAttendanceGrid(actionConfig, month);
  const k = gridKpis(g.rows, g.days, g.today);

  const items: KpiItem[] = [
    {
      label: "In today",
      tone: "bg-primary/10 text-primary",
      icon: <Users />,
      value: k.hasToday ? `${k.inToday}/${k.totalSe}` : "—",
      sub: k.hasToday ? `${k.absentToday} absent · ${k.onFieldNow} on field now` : "not the current month",
    },
    {
      label: "Attendance · MTD",
      tone: "bg-green-100 text-green-700",
      icon: <UserCheck />,
      value: k.totalWorkingDays > 0 ? `${fmtDays(k.presentDays)} / ${k.totalWorkingDays}` : "—",
      sub: "present days / working days",
    },
    {
      label: "Avg on-field",
      tone: "bg-amber-100 text-amber-700",
      icon: <Clock />,
      value: k.avgHours != null ? hoursLabel(k.avgHours) : "—",
      sub: k.avgHours != null ? "per day ended" : "needs End-day taps",
    },
    {
      label: "Distance · MTD",
      tone: "bg-indigo-100 text-indigo-700",
      icon: <Route />,
      value: k.totalKm > 0 ? km(k.totalKm) : "—",
      sub: k.kmToday > 0 ? `${km(k.kmToday)} today` : "odometer-based",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <KpiRow items={items} isLoading={g.isLoading} />
      <div className="flex justify-end">
        <StatusLegend />
      </div>
      <AttendanceGridTable
        dayMeta={g.dayMeta}
        rows={g.rows}
        today={g.today}
        isLoading={g.isLoading}
        canEdit={canEdit}
        onEdit={g.setEdit}
      />
      {canEdit ? (
        <CellEditDialog
          target={g.edit}
          onClose={() => g.setEdit(null)}
          onSave={g.saveCell}
          onClear={g.clearCell}
          onHolidayAll={g.holidayAllForDate}
          saving={g.saving}
          error={g.error}
        />
      ) : null}
    </div>
  );
}
