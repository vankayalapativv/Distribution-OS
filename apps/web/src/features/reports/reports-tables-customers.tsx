"use client";

/** Customer analytics — one row per customer active in the period
 *  (moved from the dashboard 2026-08-25). Sorted by oils desc by the API. */
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
import type { CustomerReportRow } from "./reports-types";

export function CustomersTable({ rows }: Readonly<{ rows: CustomerReportRow[] }>) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Customer</TableHead>
          <TableHead>Sales executive</TableHead>
          <TableHead className="text-right">Oils (L)</TableHead>
          <TableHead className="text-right">Orders</TableHead>
          <TableHead className="text-right">Collected</TableHead>
          <TableHead className="text-right">Pending</TableHead>
          <TableHead className="text-right">Last order</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <EmptyRow colSpan={8} />
        ) : (
          rows.map((r) => (
            <TableRow key={r.customerId}>
              <TableCell className="font-medium">
                {r.customerName}
                {r.customerCode ? (
                  <span className="ml-2 font-mono text-xs text-muted-foreground">{r.customerCode}</span>
                ) : null}
              </TableCell>
              <TableCell className="text-muted-foreground">{r.salesExecutive ?? "—"}</TableCell>
              <TableCell className={RIGHT}>{litres(r.litres)}</TableCell>
              <TableCell className={RIGHT}>{r.orders || "—"}</TableCell>
              <TableCell className={RIGHT}>{rupees(r.collected)}</TableCell>
              <TableCell className={RIGHT}>{r.pendingCollections || "—"}</TableCell>
              <TableCell className={RIGHT}>{r.lastOrderDate ?? "—"}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
