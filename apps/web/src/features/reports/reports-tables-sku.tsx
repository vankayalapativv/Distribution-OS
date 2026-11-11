"use client";

/** Billed SKU table (from invoices) for Oils. `unit` names
 *  the second column and `unitCell` renders it — litres vs plain quantity. */
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
import type { SkuReportRow } from "./reports-types";

export function SkuTable({
  rows,
  unit,
  unitCell,
}: Readonly<{
  rows: SkuReportRow[];
  unit: string;
  unitCell: (r: SkuReportRow) => string | number;
}>) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{unit === "Litres" ? "Product" : "Part no"}</TableHead>
          <TableHead className="text-right">{unit}</TableHead>
          <TableHead className="text-right">Invoices</TableHead>
          <TableHead className="text-right">Customers</TableHead>
          <TableHead className="text-right">₹ before GST</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <EmptyRow colSpan={5} />
        ) : (
          rows.map((r) => (
            <TableRow key={r.name}>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell className={RIGHT}>{unitCell(r)}</TableCell>
              <TableCell className={RIGHT}>{r.invoices}</TableCell>
              <TableCell className={RIGHT}>{r.customers}</TableCell>
              <TableCell className={RIGHT}>{rupees(r.beforeGst)}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

export const skuOilsCell = (r: SkuReportRow) => litres(r.litres);
