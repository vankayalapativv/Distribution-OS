"use client";

import { useState, type ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { withQueryClient } from "@/components/data-table/query-provider";
import { DashboardShell } from "@/features/shell/dashboard-shell";
import type { DashboardRole } from "@/features/shell/dashboard-nav";
import type { ActionConfig } from "@/lib/api-client";
import { useUrlParam } from "@/lib/use-url-state";
import { AttendanceDaily } from "./attendance-daily";
import { DateNav, MonthNav } from "./attendance-controls";
import { AttendanceGrid } from "./attendance-grid";
import { thisMonth, todayYmd } from "./attendance-format";
import { shiftMonth } from "./attendance-grid-utils";

type Tab = "daily" | "monthly";

function TabButton({
  active,
  onClick,
  children,
}: Readonly<{
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}

function AttendanceViewInner({
  role,
  actionConfig,
}: Readonly<{
  role: DashboardRole;
  actionConfig: ActionConfig;
}>) {
  const [tabParam, setTab] = useUrlParam("tab", { defaultValue: "monthly" });
  const tab = (tabParam as Tab) || "monthly";

  const [month, setMonth] = useState(thisMonth());
  const [date, setDate] = useState(todayYmd());

  const subtitle =
    role === "SUPER_ADMIN"
      ? "Present is pre-filled from GPS day tracking — click any cell to set Present, Absent, Half day, Leave, or Week-off."
      : "Sales Executive attendance, pre-filled from GPS day tracking.";

  return (
    <DashboardShell
      role={role}
      active="attendance"
      // Cap + centre the content so the KPI tiles and the attendance matrix sit
      // denser and more centred instead of sprawling across wide monitors (the
      // layout read as too wide / mostly empty space on big screens). Other pages
      // keep the shell's default full-width content.
      contentClassName="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-6 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7"
    >
      <PageHeader title="Attendance" subtitle={subtitle} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-fit gap-1 rounded-full border border-border bg-card p-1">
          <TabButton active={tab === "monthly"} onClick={() => setTab("monthly")}>
            Monthly
          </TabButton>
          <TabButton active={tab === "daily"} onClick={() => setTab("daily")}>
            Daily
          </TabButton>
        </div>
        {tab === "monthly" ? (
          <MonthNav
            month={month}
            onShift={(by) => setMonth((m) => shiftMonth(m, by))}
            atCurrentMonth={month >= thisMonth()}
          />
        ) : (
          <DateNav date={date} setDate={setDate} />
        )}
      </div>

      {tab === "monthly" ? (
        <AttendanceGrid actionConfig={actionConfig} role={role} month={month} />
      ) : (
        <AttendanceDaily actionConfig={actionConfig} date={date} />
      )}
    </DashboardShell>
  );
}

export const AttendanceView = withQueryClient(AttendanceViewInner);
