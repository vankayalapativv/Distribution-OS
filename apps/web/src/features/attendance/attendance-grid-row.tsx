"use client";

import { cn } from "@/lib/utils";
import {
  ATTENDANCE_STATUS_META,
  type AttendanceCell,
  type AttendanceGridRow as Row,
} from "./attendance-api";
import type { EditTarget } from "./attendance-cell-dialog";
import { fmtDays, hoursLabel, initials, km } from "./attendance-format";
import { cellHours, rowTotals } from "./attendance-stats";

/** Cell glyph: on-field hours when known, else the status short code (· for week-off). */
function dayContent(c: AttendanceCell): string {
  if (!c.status) return "";
  if (c.status === "present" || c.status === "half_day") {
    const h = cellHours(c.startTime, c.endTime);
    if (h != null) return String(Math.round(h));
    return ATTENDANCE_STATUS_META[c.status].short;
  }
  if (c.status === "week_off") return "·";
  return ATTENDANCE_STATUS_META[c.status].short;
}

/** Hover tooltip for a cell: status + where it came from + on-field hours when known. */
function cellTitle(c: AttendanceCell): string {
  if (!c.status) return "Upcoming";
  let source = "";
  if (c.manual) source = " · set manually";
  else if (c.tracked) source = " · tracked";
  const h = cellHours(c.startTime, c.endTime);
  const hours = h != null ? ` · ${hoursLabel(h)}` : "";
  return `${ATTENDANCE_STATUS_META[c.status].label}${source}${hours}`;
}

/** One SE row: sticky name + avatar, a status-coloured cell per day, then Hrs / Km / % totals. */
export function AttendanceGridRow({
  row,
  today,
  canEdit,
  onEdit,
}: Readonly<{
  row: Row;
  today: string;
  canEdit: boolean;
  onEdit: (t: EditTarget) => void;
}>) {
  const t = rowTotals(row);
  return (
    <tr className="group">
      <td className="sticky left-0 z-10 border-b border-r border-border bg-card px-3 py-0 group-hover:bg-muted">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full border border-primary/20 bg-primary/10 font-mono text-[11px] font-semibold text-primary">
            {initials(row.name)}
          </span>
          <span className="whitespace-nowrap font-medium">{row.name}</span>
        </div>
      </td>
      {row.days.map((c) => {
        const meta = c.status ? ATTENDANCE_STATUS_META[c.status] : null;
        const editable = canEdit && c.status !== null; // future cells are locked
        return (
          <td key={c.date} className="border-b border-l border-border p-0 text-center">
            <button
              type="button"
              disabled={!editable}
              onClick={() => editable && onEdit({ userId: row.userId, name: row.name, cell: c })}
              title={cellTitle(c)}
              className={cn(
                "relative flex h-11 w-full items-center justify-center font-mono text-[11px] font-semibold tabular-nums transition-[filter]",
                meta ? meta.cell : "text-muted-foreground/30",
                c.date === today && "ring-2 ring-inset ring-primary",
                editable && "cursor-pointer hover:brightness-95",
              )}
            >
              {dayContent(c)}
              {c.manual ? (
                <span className="absolute right-1 top-1 size-1.5 rounded-full bg-primary" aria-hidden />
              ) : null}
            </button>
          </td>
        );
      })}
      <td className="whitespace-nowrap border-b border-l border-border bg-card px-3 text-right font-mono text-xs tabular-nums group-hover:bg-muted">
        {t.hours > 0 ? hoursLabel(t.hours) : "—"}
      </td>
      <td className="whitespace-nowrap border-b border-border bg-card px-3 text-right font-mono text-xs tabular-nums group-hover:bg-muted">
        {t.km > 0 ? km(t.km) : "—"}
      </td>
      <td className="whitespace-nowrap border-b border-border bg-card px-3 text-right font-mono text-xs font-semibold tabular-nums group-hover:bg-muted">
        {t.totalWorkingDays > 0 ? `${fmtDays(t.presentDays)} / ${t.totalWorkingDays}` : "—"}
      </td>
    </tr>
  );
}
