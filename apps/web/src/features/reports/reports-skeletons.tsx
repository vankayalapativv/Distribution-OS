"use client";

/** Context-aware loading UI for the Reports page: an overview skeleton that
 *  mirrors the KPI strip + Overall + per-brand card sections, a chart shimmer
 *  shaped to each report's chart kind (bars vs line/area), and a table shimmer
 *  shaped to each report's columns/cells. */
import { Fragment, type ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { KpiStripSkeleton } from "./reports-kpi-strip";
import {
  type ChartKind,
  REPORT_COLUMNS,
  REPORTS_SUBTITLE,
  REPORTS_TITLE,
  TABLE_VARIANT,
} from "./reports-catalog";
import type { ReportKey } from "./reports-types";

/** Card wrapper shared by a drilled-in report and its heading. */
export function Section({ heading, children }: { readonly heading: string; readonly children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <h3 className="border-b border-border px-5 py-3 text-sm font-semibold text-foreground">{heading}</h3>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

// ── Chart shimmer (type-aware) ───────────────────────────────────────────────

/** Horizontal-bars shimmer: a label + a varying-width bar per row. */
function BarChartSkeleton() {
  const widths = ["w-3/4", "w-1/2", "w-5/6", "w-2/5", "w-2/3", "w-1/3"];
  return (
    <div className="flex flex-col gap-3 py-2">
      {widths.map((w, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-3 w-24 shrink-0" />
          <Skeleton className={`h-6 ${w}`} />
        </div>
      ))}
      <div className="mt-1 flex justify-between px-24">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-2.5 w-8" />
        ))}
      </div>
    </div>
  );
}

/** Line/area trend shimmer: faint gridlines + an area polygon + month ticks. */
function SeriesChartSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-[260px] w-full overflow-hidden">
        {/* gridlines */}
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="absolute inset-x-0 border-t border-border/50" style={{ top: `${i * 33}%` }} />
        ))}
        {/* area/line */}
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-0 h-full w-full animate-pulse">
          <polygon points="0,36 14,30 28,32 42,22 56,26 70,14 84,18 100,9 100,40 0,40" className="fill-muted/60" />
          <polyline
            points="0,36 14,30 28,32 42,22 56,26 70,14 84,18 100,9"
            className="fill-none stroke-muted-foreground/40"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div className="flex justify-between px-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-2.5 w-10" />
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton({ kind }: Readonly<{ kind: ChartKind }>) {
  if (kind === "series") return <SeriesChartSkeleton />;
  return <BarChartSkeleton />;
}

// ── Table shimmer (shaped per report) ────────────────────────────────────────

const RIGHT = "text-right";

/** A left name cell (optionally a name + code stack for "wide" tables). */
function LeadCell({ stacked }: Readonly<{ stacked?: boolean }>) {
  return (
    <TableCell>
      {stacked ? (
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-2.5 w-20" />
        </div>
      ) : (
        <Skeleton className="h-4 w-40" />
      )}
    </TableCell>
  );
}

function NumCells({ count }: Readonly<{ count: number }>) {
  return (
    <>
      {Array.from({ length: Math.max(count, 0) }, (_, i) => `n${i}`).map((k) => (
        <TableCell key={k} className={RIGHT}>
          <Skeleton className="ml-auto h-4 w-10" />
        </TableCell>
      ))}
    </>
  );
}

function HeadRow({ columns, stacked }: Readonly<{ columns: number; stacked?: boolean }>) {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>
          <Skeleton className={`h-3 ${stacked ? "w-24" : "w-28"}`} />
        </TableHead>
        {Array.from({ length: Math.max(columns - 1, 0) }, (_, i) => `h${i}`).map((k) => (
          <TableHead key={k} className={RIGHT}>
            <Skeleton className="ml-auto h-3 w-12" />
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}

/** "matrix" / "wide": one row per entity, a lead cell + numeric columns. */
function FlatSkeleton({ columns, rows = 6, stacked }: Readonly<{ columns: number; rows?: number; stacked?: boolean }>) {
  return (
    <Table>
      <HeadRow columns={columns} stacked={stacked} />
      <TableBody>
        {Array.from({ length: rows }, (_, r) => `r${r}`).map((rowKey) => (
          <TableRow key={rowKey}>
            <LeadCell stacked={stacked} />
            <NumCells count={columns - 1} />
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** "grouped": group-header rows (shaded) each followed by a few indented lines. */
function GroupedSkeleton({ columns, groups = 3 }: Readonly<{ columns: number; groups?: number }>) {
  return (
    <Table>
      <HeadRow columns={columns} />
      <TableBody>
        {Array.from({ length: groups }, (_, g) => `g${g}`).map((groupKey) => (
          <Fragment key={groupKey}>
            <TableRow className="bg-muted/50">
              <TableCell>
                <Skeleton className="h-4 w-36" />
              </TableCell>
              <NumCells count={columns - 1} />
            </TableRow>
            {Array.from({ length: 2 }).map((_, l) => (
              <TableRow key={l}>
                <TableCell className="pl-8">
                  <Skeleton className="h-3.5 w-44" />
                </TableCell>
                <NumCells count={columns - 1} />
              </TableRow>
            ))}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  );
}

/** The table shimmer shaped to one report's variant + column count. */
export function ReportTableSkeleton({ reportKey }: Readonly<{ reportKey: ReportKey }>) {
  const columns = REPORT_COLUMNS[reportKey];
  const variant = TABLE_VARIANT[reportKey];
  if (variant === "grouped") return <GroupedSkeleton columns={columns} />;
  return <FlatSkeleton columns={columns} stacked={variant === "wide"} />;
}

/** Back-compat: a plain column-count table skeleton. */
export function TableSkeleton({ columns, rows = 6 }: { readonly columns: number; readonly rows?: number }) {
  return <FlatSkeleton columns={columns} rows={rows} />;
}

// ── Overview shimmer (mirrors the real sections) ─────────────────────────────

function OverviewCard() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-white p-4 shadow-sm">
      <Skeleton className="size-11 flex-none rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  );
}

function CardGrid({ count }: Readonly<{ count: number }>) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => `card${i}`).map((k) => (
        <OverviewCard key={k} />
      ))}
    </div>
  );
}

function CardSection({ headingWidth, count }: Readonly<{ headingWidth: string; count: number }>) {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className={`h-3 ${headingWidth}`} />
      <CardGrid count={count} />
    </div>
  );
}

/** Overview loading state: KPI strip + Overall (16) + two per-brand sections (6). */
export function ReportsSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <KpiStripSkeleton />
        <Skeleton className="h-3 w-36" />
        <CardGrid count={16} />
      </div>
      <CardSection headingWidth="w-44" count={6} />
      <CardSection headingWidth="w-48" count={6} />
    </div>
  );
}

/** Load skeleton: static title/subtitle + a picker placeholder, then the
 *  overview shimmer, while the code-split chunk loads. */
export function ReportsPageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={REPORTS_TITLE}
        subtitle={REPORTS_SUBTITLE}
        action={<Skeleton className="h-9 w-44 rounded-md" />}
      />
      <ReportsSkeleton />
    </div>
  );
}
