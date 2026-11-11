"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { durationLabel, isAdminRole, timeRange, visitorRoleLabel, whenParts, type MissedRow, type VisitRow } from "./customer-visits-logic";

/** The visitor's name over a small role badge (Executive / Super Admin). */
function VisitedByCell({ name, role }: Readonly<{ name: string; role: string }>) {
  const admin = isAdminRole(role);
  const label = visitorRoleLabel(role);
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-medium text-foreground">{name}</span>
      {label !== "—" ? (
        <span
          className={cn(
            "w-fit rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            admin ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600",
          )}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
}

/** Bold date over the muted check-in → check-out time range — the Date & time cell. */
export function WhenCell({ iso, date, checkOut }: Readonly<{ iso: string | null; date: string | null; checkOut?: string | null }>) {
  const w = whenParts(iso, date);
  const time = iso ? timeRange(iso, checkOut ?? null) : w.time;
  return (
    <>
      <span className="font-medium text-foreground">{w.date}</span>
      {time ? <span className="block text-xs text-muted-foreground">{time}</span> : null}
    </>
  );
}

/** A missed beat stop rendered as a table row: date · 7 PM · SE · red "Missed" · —.
 *  Informational only — these are NOT counted in the visit total or tiles. */
export function MissedBeatRow({ row }: Readonly<{ row: MissedRow }>) {
  return (
    <TableRow className="bg-red-50/40">
      <TableCell className="whitespace-nowrap">
        <WhenCell iso={row.at} date={row.date} />
      </TableCell>
      <TableCell className="text-slate-400">—</TableCell>
      <TableCell className="whitespace-nowrap">
        <VisitedByCell name={row.executiveName} role="SALES_EXECUTIVE" />
      </TableCell>
      <TableCell>
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">Missed</span>
      </TableCell>
      <TableCell>
        <span className="text-xs text-slate-400">—</span>
      </TableCell>
    </TableRow>
  );
}

/** A real check-in row: date/time · SE · planned/unplanned · outcome chips. */
export function VisitTableRow({ row: v }: Readonly<{ row: VisitRow }>) {
  const noOutcome = v.orders.length === 0 && v.collections.length === 0 && v.marketIntelCount === 0;
  let outcomeFallback: ReactNode = null;
  if (noOutcome && v.noOutcomeReason) {
    outcomeFallback = <span className="text-xs italic text-amber-600">{v.noOutcomeReason}</span>;
  } else if (noOutcome) {
    outcomeFallback = <span className="text-xs text-slate-400">—</span>;
  }
  return (
    <TableRow className="transition-colors hover:bg-accent/40">
      <TableCell className="whitespace-nowrap">
        <WhenCell iso={v.checkInTime} date={v.visitDate} checkOut={v.checkOutTime} />
      </TableCell>
      <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{durationLabel(v.durationMinutes)}</TableCell>
      <TableCell className="whitespace-nowrap">
        <VisitedByCell name={v.executiveName} role={v.executiveRole} />
      </TableCell>
      <TableCell>
        <span className={cn(
          "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
          v.type === "planned" ? "bg-primary/10 text-primary" : "bg-amber-50 text-amber-700",
        )}>{v.type}</span>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-1">
          {outcomeFallback}
          {v.orders.map((o) => (
            <Link key={o.id} href={`/orders/${o.id}`}
              className="rounded-full bg-blue-50 px-2 py-0.5 font-mono text-[11px] font-medium text-blue-700 transition-colors hover:bg-blue-100 hover:underline">
              {o.code}
            </Link>
          ))}
          {v.collections.map((c) => (
            <Link key={c.id} href={`/collections/${c.id}`}
              className="rounded-full bg-emerald-50 px-2 py-0.5 font-mono text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-100 hover:underline">
              {c.code}
            </Link>
          ))}
          {v.marketIntelCount > 0 ? (
            <Link href="/market-intelligence"
              className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 transition-colors hover:bg-violet-100 hover:underline">
              Market intel · {v.marketIntelCount}
            </Link>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}
