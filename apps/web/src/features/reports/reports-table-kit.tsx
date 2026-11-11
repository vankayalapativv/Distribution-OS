"use client";

/** Shared table primitives + the SegmentTable generic (Sales / Collections). */
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const RIGHT = "text-right tabular-nums";

export function EmptyRow({ colSpan }: { readonly colSpan: number }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-8 text-center text-sm text-muted-foreground">
        No data for this period.
      </TableCell>
    </TableRow>
  );
}

interface SegRow {
  userId: string;
  name: string;
  segments: Record<string, number>;
  total: number;
}

/** Executive × segment matrix. `fmt` renders each cell (litres or rupees). */
export function SegmentTable({
  segments,
  rows,
  fmt,
}: {
  readonly segments: string[];
  readonly rows: SegRow[];
  readonly fmt: (n: number) => string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Sales executive</TableHead>
          {segments.map((s) => (
            <TableHead key={s} className="text-right">{s}</TableHead>
          ))}
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <EmptyRow colSpan={segments.length + 2} />
        ) : (
          rows.map((r) => (
            <TableRow key={r.userId}>
              <TableCell className="font-medium">{r.name}</TableCell>
              {segments.map((s) => (
                <TableCell key={s} className={RIGHT}>{fmt(r.segments[s] ?? 0)}</TableCell>
              ))}
              <TableCell className={`${RIGHT} font-semibold`}>{fmt(r.total)}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
