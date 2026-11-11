"use client";

/** Time & attendance table — per SE + Logistics person: days present +
 *  attendance %, avg working hours/day, avg visit duration, avg visits/day. */
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyRow, RIGHT } from "./reports-table-kit";
import type { AttendanceSummaryRow } from "./reports-types";

const roleLabel = (r: string) => (r === "LOGISTICS" ? "Logistics" : "Sales Exec");
const pct = (v: number | null) => (v == null ? "—" : `${v}%`);
const hrs = (v: number | null) => (v == null ? "—" : `${v} h`);
const mins = (v: number | null) => (v == null ? "—" : `${v} min`);
const one = (v: number | null) => (v == null ? "—" : String(v));

function tone(v: number | null): string {
  if (v == null) return "";
  if (v >= 85) return "text-green-700";
  if (v >= 60) return "text-amber-700";
  return "text-red-600";
}

export function AttendanceTable({ rows }: Readonly<{ rows: AttendanceSummaryRow[] }>) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Person</TableHead>
          <TableHead className="text-right">Days present</TableHead>
          <TableHead className="text-right">Attendance</TableHead>
          <TableHead className="text-right">Avg hrs/day</TableHead>
          <TableHead className="text-right">Avg visit</TableHead>
          <TableHead className="text-right">Avg visits/day</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <EmptyRow colSpan={6} />
        ) : (
          rows.map((r) => (
            <TableRow key={r.userId}>
              <TableCell>
                <div className="font-medium text-foreground">{r.name}</div>
                <div className="text-xs text-muted-foreground">{roleLabel(r.role)}</div>
              </TableCell>
              <TableCell className={RIGHT}>
                {r.daysPresent}<span className="text-muted-foreground"> / {r.workingDays}</span>
              </TableCell>
              <TableCell className={`${RIGHT} font-semibold ${tone(r.attendancePct)}`}>{pct(r.attendancePct)}</TableCell>
              <TableCell className={RIGHT}>{hrs(r.avgHoursPerDay)}</TableCell>
              <TableCell className={RIGHT}>{mins(r.avgVisitMinutes)}</TableCell>
              <TableCell className={RIGHT}>{one(r.avgVisitsPerDay)}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
