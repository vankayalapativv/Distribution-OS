"use client";

/** Oils by segment (order-based): a per-segment total row with product children. */
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
import type { OilSegmentGroup } from "./reports-types";

export function OilsTable({ groups }: { readonly groups: OilSegmentGroup[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Product</TableHead>
          <TableHead className="text-right">Oils (L)</TableHead>
          <TableHead className="text-right">Qty</TableHead>
          <TableHead className="text-right">Orders</TableHead>
          <TableHead className="text-right">Customers</TableHead>
          <TableHead className="text-right">Share</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.length === 0 ? (
          <EmptyRow colSpan={6} />
        ) : (
          groups.map((g) => (
            <Fragment key={g.segment}>
              <TableRow className="bg-muted/50">
                <TableCell className="font-semibold">{g.segment}</TableCell>
                <TableCell className={`${RIGHT} font-semibold`}>{litres(g.totalLitres)}</TableCell>
                <TableCell colSpan={4} />
              </TableRow>
              {g.products.map((p) => (
                <TableRow key={`${g.segment}-${p.product}`}>
                  <TableCell className="pl-8">{p.product}</TableCell>
                  <TableCell className={RIGHT}>{litres(p.litres)}</TableCell>
                  <TableCell className={RIGHT}>{p.quantity || "—"}</TableCell>
                  <TableCell className={RIGHT}>{p.orders || "—"}</TableCell>
                  <TableCell className={RIGHT}>{p.customers || "—"}</TableCell>
                  <TableCell className={RIGHT}>{`${p.share.toFixed(1)}%`}</TableCell>
                </TableRow>
              ))}
            </Fragment>
          ))
        )}
      </TableBody>
    </Table>
  );
}
