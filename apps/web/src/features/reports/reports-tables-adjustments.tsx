"use client";

/** Cancelled / Returned table — oils only (this distributor is oils-only):
 *  executive × segment, with Partially/Fully sub-rows + % of ordered. */
import { Fragment } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { litres } from "@/lib/format";
import { EmptyRow, RIGHT } from "./reports-table-kit";
import type { AdjSegRow, AdjustmentReport } from "./reports-types";

function OilsTable({ segments, rows }: Readonly<{ segments: string[]; rows: AdjSegRow[] }>) {
  const span = segments.length + 3;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Sales executive</TableHead>
          {segments.map((s) => (
            <TableHead key={s} className="text-right">{s}</TableHead>
          ))}
          <TableHead className="text-right">Total (L)</TableHead>
          <TableHead className="text-right">% ordered</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <EmptyRow colSpan={span} />
        ) : (
          rows.map((r) => (
            <Fragment key={r.userId}>
              <TableRow className="bg-muted/50">
                <TableCell className="font-semibold">{r.name}</TableCell>
                {segments.map((s) => (
                  <TableCell key={s} className={`${RIGHT} font-semibold`}>
                    {litres((r.partial[s] ?? 0) + (r.full[s] ?? 0))}
                  </TableCell>
                ))}
                <TableCell className={`${RIGHT} font-semibold`}>{litres(r.total)}</TableCell>
                <TableCell className={`${RIGHT} font-semibold`}>{r.percent}%</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8 text-muted-foreground">Partially</TableCell>
                {segments.map((s) => (
                  <TableCell key={s} className={RIGHT}>{litres(r.partial[s] ?? 0)}</TableCell>
                ))}
                <TableCell className={RIGHT}>{litres(r.partialTotal)}</TableCell>
                <TableCell />
              </TableRow>
              <TableRow>
                <TableCell className="pl-8 text-muted-foreground">Fully</TableCell>
                {segments.map((s) => (
                  <TableCell key={s} className={RIGHT}>{litres(r.full[s] ?? 0)}</TableCell>
                ))}
                <TableCell className={RIGHT}>{litres(r.fullTotal)}</TableCell>
                <TableCell />
              </TableRow>
            </Fragment>
          ))
        )}
      </TableBody>
    </Table>
  );
}

export function AdjustmentTables({ report }: Readonly<{ report: AdjustmentReport }>) {
  return <OilsTable segments={report.segments} rows={report.oils} />;
}
