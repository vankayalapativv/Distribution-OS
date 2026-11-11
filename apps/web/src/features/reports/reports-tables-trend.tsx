"use client";

/** The billed 6-month trend (oils). */
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { litres, rupees } from "@/lib/format";
import { EmptyRow, RIGHT } from "./reports-table-kit";
import type { TrendMonth } from "./reports-types";

export function TrendTable({ months }: Readonly<{ months: TrendMonth[] }>) {
  const hasData = months.some((m) => m.beforeGst > 0);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Month</TableHead>
          <TableHead className="text-right">Oils (L)</TableHead>
          <TableHead className="text-right">₹ before GST</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {!hasData ? (
          <EmptyRow colSpan={3} />
        ) : (
          months.map((m) => (
            <TableRow key={m.month}>
              <TableCell className="font-medium">{m.month}</TableCell>
              <TableCell className={RIGHT}>{litres(m.litres)}</TableCell>
              <TableCell className={RIGHT}>{rupees(m.beforeGst)}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
