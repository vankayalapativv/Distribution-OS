"use client";

import { durationLabel, roleProductivityPct, type VisitRoleStat } from "./customer-visits-logic";

/** "60%" or "—" for a role's productivity. */
const pctLabel = (pct: number | null): string => (pct == null ? "—" : `${pct}%`);

/** The all-time avg-time + productivity chips, split by visitor role (exec / admin). */
export function VisitRoleChips({
  byRole,
}: Readonly<{ byRole: { executive: VisitRoleStat; admin: VisitRoleStat } }>) {
  return (
    <>
      <span
        className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
        title="All-time average time spent per visit (manual check-outs only), by visitor role"
      >
        <span>Avg time</span>
        <span className="ml-1 tabular-nums">Exec {durationLabel(byRole.executive.avgDurationMinutes)}</span>
        <span className="mx-1 text-slate-400">·</span>
        <span className="tabular-nums">Admin {durationLabel(byRole.admin.avgDurationMinutes)}</span>
      </span>
      <span
        className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
        title="All-time productivity (visits that produced an order or collection), by visitor role"
      >
        <span>Productivity</span>
        <span className="ml-1 tabular-nums">Exec {pctLabel(roleProductivityPct(byRole.executive))}</span>
        <span className="mx-1 text-emerald-300">·</span>
        <span className="tabular-nums">Admin {pctLabel(roleProductivityPct(byRole.admin))}</span>
      </span>
    </>
  );
}
