"use client";

import type { ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shimmer } from "@/components/ui/shimmer";
import { cn } from "@/lib/utils";
import { MissedBeatRow, VisitTableRow } from "./customer-visit-rows";
import { SKELETON_COLS, SKELETON_ROW_KEYS, type FeedRow, type VisitsData } from "./customer-visits-logic";

/** The visits table: header, a context-aware skeleton while loading, an empty
 *  state, or the merged check-in / missed-beat feed for the current page. */
export function CustomerVisitsTable({
  isLoading,
  data,
  feed,
}: Readonly<{
  isLoading: boolean;
  data: VisitsData | undefined;
  feed: FeedRow[];
}>) {
  let body: ReactNode;
  if (isLoading) {
    body = SKELETON_ROW_KEYS.map((rowKey) => (
      <TableRow key={rowKey}>
        {SKELETON_COLS.map((c) => (
          <TableCell key={c.key}>
            <Shimmer className={c.block} />
            {c.sub ? <Shimmer className={cn("mt-1.5", c.sub)} /> : null}
          </TableCell>
        ))}
      </TableRow>
    ));
  } else if (data && feed.length === 0) {
    body = (
      <TableRow>
        <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
          No check-ins recorded for this customer in this period.
        </TableCell>
      </TableRow>
    );
  } else {
    body = feed.map((f, i) =>
      f.kind === "missed" ? (
        <MissedBeatRow key={`missed-${f.missed.date}-${i}`} row={f.missed} />
      ) : (
        <VisitTableRow key={f.visit.id} row={f.visit} />
      ),
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead>Date &amp; time</TableHead>
            <TableHead>Time spent</TableHead>
            <TableHead>Visited by</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Outcome</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>{body}</TableBody>
      </Table>
    </div>
  );
}
