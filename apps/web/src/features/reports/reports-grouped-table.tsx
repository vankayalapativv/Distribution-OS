"use client";

/** Generic grouped report table: a per-SE header row, its child line-items, and
 *  a grand-total footer. Used by Order backlog and Ordered-not-invoiced. */
import { Fragment } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyRow, RIGHT } from "./reports-table-kit";

export interface GroupRow {
  key: string;
  name: string;
  count: number;
  total: number;
  lines: { code: string; customer: string; value: number }[];
}

export function GroupedTable({
  codeHead,
  valueHead,
  noun,
  fmt,
  groups,
  total,
  totalCount,
}: {
  readonly codeHead: string;
  readonly valueHead: string;
  readonly noun: string;
  readonly fmt: (n: number) => string;
  readonly groups: GroupRow[];
  readonly total: number;
  readonly totalCount: number;
}) {
  const plural = (n: number) => `${n} ${noun}${n === 1 ? "" : "s"}`;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{codeHead}</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead className="text-right">{valueHead}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.length === 0 ? (
          <EmptyRow colSpan={3} />
        ) : (
          <>
            {groups.map((g) => (
              <Fragment key={g.key}>
                <TableRow className="bg-muted/50">
                  <TableCell colSpan={2} className="font-semibold">
                    {g.name} · {plural(g.count)}
                  </TableCell>
                  <TableCell className={`${RIGHT} font-semibold`}>{fmt(g.total)}</TableCell>
                </TableRow>
                {g.lines.map((l) => (
                  <TableRow key={l.code}>
                    <TableCell className="pl-8 font-mono text-xs">{l.code}</TableCell>
                    <TableCell>{l.customer}</TableCell>
                    <TableCell className={RIGHT}>{fmt(l.value)}</TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}
            <TableRow className="border-t-2">
              <TableCell colSpan={2} className="font-semibold">
                Total · {plural(totalCount)}
              </TableCell>
              <TableCell className={`${RIGHT} font-semibold`}>{fmt(total)}</TableCell>
            </TableRow>
          </>
        )}
      </TableBody>
    </Table>
  );
}
