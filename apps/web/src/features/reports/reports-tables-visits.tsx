"use client";

/** Visit/productivity tables: productivity-% matrix (exec × month), customer
 *  best/worst per executive, the monthly visits trend, and the collections
 *  6-month trend (₹). */
import { Fragment } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { rupees } from "@/lib/format";
import { EmptyRow, RIGHT } from "./reports-table-kit";
import type {
  CollectionTrendMonth,
  CustomerProductivity,
  CustProdEntry,
  ProductivityTrend,
  VisitsTrend,
} from "./reports-types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-09" → "Sep 26". */
function mon(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MONTHS[Number(m) - 1] ?? ym} ${y?.slice(2) ?? ""}`.trim();
}
const pctCell = (p: number | null) => (p === null ? "—" : `${p}%`);

export function ProductivityTrendTable({ data }: Readonly<{ data: ProductivityTrend }>) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Sales executive</TableHead>
          {data.months.map((m) => (
            <TableHead key={m} className="text-right">{mon(m)}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.rows.length === 0 ? (
          <EmptyRow colSpan={data.months.length + 1} />
        ) : (
          data.rows.map((r) => {
            const byMonth = new Map(r.points.map((p) => [p.month, p]));
            return (
              <TableRow key={r.userId}>
                <TableCell className="font-medium">{r.name}</TableCell>
                {data.months.map((m) => (
                  <TableCell key={m} className={RIGHT}>{pctCell(byMonth.get(m)?.pct ?? null)}</TableCell>
                ))}
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}

function CustCell({ entry }: Readonly<{ entry: CustProdEntry | undefined }>) {
  if (!entry) return <span className="text-muted-foreground">—</span>;
  return (
    <span>
      <span className="font-medium text-foreground">{entry.customer}</span>
      <span className="text-muted-foreground">
        {" "}· {pctCell(entry.pct)} ({entry.productive}/{entry.visits})
      </span>
    </span>
  );
}

/** Top-N highest & lowest productivity customers per executive, side by side. */
export function CustomerProductivityTable({ data }: Readonly<{ data: CustomerProductivity }>) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10 text-right">#</TableHead>
          <TableHead>Highest productivity customers</TableHead>
          <TableHead>Lowest productivity customers</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.rows.length === 0 ? (
          <EmptyRow colSpan={3} />
        ) : (
          data.rows.map((r) => {
            const n = Math.max(r.highest.length, r.lowest.length);
            return (
              <Fragment key={r.userId}>
                <TableRow className="bg-muted/50">
                  <TableCell colSpan={3} className="font-semibold text-foreground">{r.name}</TableCell>
                </TableRow>
                {Array.from({ length: n }, (_, i) => i).map((i) => (
                  <TableRow key={i}>
                    <TableCell className={`${RIGHT} text-muted-foreground`}>{i + 1}</TableCell>
                    <TableCell><CustCell entry={r.highest[i]} /></TableCell>
                    <TableCell><CustCell entry={r.lowest[i]} /></TableCell>
                  </TableRow>
                ))}
              </Fragment>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}

export function VisitsTrendTable({ data }: Readonly<{ data: VisitsTrend }>) {
  const span = data.months.length + 2;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Sales executive</TableHead>
          {data.months.map((m) => (
            <TableHead key={m} className="text-right">{mon(m)}</TableHead>
          ))}
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.rows.length === 0 ? (
          <EmptyRow colSpan={span} />
        ) : (
          <>
            {data.rows.map((r) => {
              const byMonth = new Map(r.points.map((p) => [p.month, p.total]));
              return (
                <TableRow key={r.userId}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  {data.months.map((m) => (
                    <TableCell key={m} className={RIGHT}>{byMonth.get(m) ?? 0}</TableCell>
                  ))}
                  <TableCell className={`${RIGHT} font-semibold`}>{r.total}</TableCell>
                </TableRow>
              );
            })}
            <TableRow className="border-t-2">
              <TableCell className="font-semibold">Total</TableCell>
              {data.months.map((m) => (
                <TableCell key={m} className={`${RIGHT} font-semibold`}>
                  {data.totals.find((t) => t.month === m)?.total ?? 0}
                </TableCell>
              ))}
              <TableCell className={`${RIGHT} font-semibold`}>{data.grandTotal}</TableCell>
            </TableRow>
          </>
        )}
      </TableBody>
    </Table>
  );
}

/** 6-month collections trend — month × ₹ total. */
export function CollectionsTrendTable({ months }: Readonly<{ months: CollectionTrendMonth[] }>) {
  const total = months.reduce((s, m) => s + m.total, 0);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Month</TableHead>
          <TableHead className="text-right">Collected</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {months.length === 0 ? (
          <EmptyRow colSpan={2} />
        ) : (
          <>
            {months.map((m) => (
              <TableRow key={m.month}>
                <TableCell className="font-medium">{mon(m.month)}</TableCell>
                <TableCell className={RIGHT}>{rupees(m.total)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t-2">
              <TableCell className="font-semibold">Total</TableCell>
              <TableCell className={`${RIGHT} font-semibold`}>{rupees(total)}</TableCell>
            </TableRow>
          </>
        )}
      </TableBody>
    </Table>
  );
}
