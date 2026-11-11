import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Shimmer } from "@/components/ui/shimmer";
import { formatDate, rupeesExact } from "@/lib/format";
import type { DuesCustomerRow } from "./dues-helpers";

/** Shared 5-column header — kept identical for the skeleton and the data table.
 *  The salesperson sits under the customer name (next to the city), so the table
 *  stays narrow. "In this band" = the customer's remaining aged into this bucket
 *  (rows sum to the bucket total); "Total" = their whole balance. */
export function DuesHead() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>Customer</TableHead>
        <TableHead>Oldest in band</TableHead>
        <TableHead className="text-right">Age</TableHead>
        <TableHead className="text-right">In this band</TableHead>
        <TableHead className="text-right">Total</TableHead>
      </TableRow>
    </TableHeader>
  );
}

/** Context-aware skeleton: the same columns, `rows` shimmer lines. */
export function DuesSkeleton({ rows }: Readonly<{ rows: number }>) {
  const keys = Array.from({ length: rows }, (_, i) => `dues-skeleton-${i}`);
  return (
    <Table>
      <DuesHead />
      <TableBody aria-hidden="true">
        {keys.map((key) => (
          <TableRow key={key}>
            <TableCell>
              <Shimmer className="h-4 w-40" />
              <Shimmer className="mt-1 h-3 w-28" />
            </TableCell>
            <TableCell><Shimmer className="h-3.5 w-20" /></TableCell>
            <TableCell className="text-right"><Shimmer className="ml-auto h-3.5 w-8" /></TableCell>
            <TableCell className="text-right"><Shimmer className="ml-auto h-4 w-20" /></TableCell>
            <TableCell className="text-right"><Shimmer className="ml-auto h-4 w-20" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function DuesTable({ rows }: Readonly<{ rows: DuesCustomerRow[] }>) {
  return (
    <Table>
      <DuesHead />
      <TableBody>
        {rows.map((r) => {
          const sub = [r.city, r.executiveName].filter(Boolean).join(" · ");
          return (
            <TableRow key={r.customerId}>
              <TableCell className="font-medium">
                <Link
                  href={`/customers/${r.customerId}`}
                  className="block text-foreground transition-colors hover:text-primary hover:underline"
                >
                  {r.customerName}
                </Link>
                {sub ? <span className="text-xs font-normal text-muted-foreground">{sub}</span> : null}
              </TableCell>
              <TableCell className="text-muted-foreground">{formatDate(r.bandOldestDate)}</TableCell>
              <TableCell className="text-right tabular-nums">{r.bandAgeDays}d</TableCell>
              <TableCell className="text-right font-semibold tabular-nums text-rose-600">
                {rupeesExact(r.bandOutstanding)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {rupeesExact(r.totalOutstanding)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
