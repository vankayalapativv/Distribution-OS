import type { ColumnDef } from "@tanstack/react-table";
import { Skeleton } from "@/components/ui/skeleton";
import type { SkeletonCell } from "@/components/data-table/data-table";
import { formatDate } from "@/lib/format";
import { PhotoCountBadge } from "./logistics-media";
import { LogisticsTimeFlow } from "./logistics-time-flow";
import { LogisticsStatusPill } from "./logistics-status-pill";
import { distanceLabel } from "./logistics-run-format";
import type { DeliveryRunRow } from "./logistics-run-types";

/** "By run" columns — one row per driver's delivery run, with start/end times. */
export const runColumns: ColumnDef<DeliveryRunRow>[] = [
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ getValue }) => <span className="tabular-nums">{formatDate(getValue() as string)}</span>,
  },
  {
    accessorKey: "driverName",
    header: "Driver · Vehicle",
    cell: ({ row }) => (
      <div>
        <div className="text-sm font-medium">{row.original.driverName ?? "—"}</div>
        <div className="font-mono text-[11px] text-muted-foreground">{row.original.vehicleNumber ?? ""}</div>
      </div>
    ),
  },
  {
    id: "time",
    header: "Start → End",
    enableSorting: false,
    cell: ({ row }) => (
      <LogisticsTimeFlow startedAt={row.original.startedAt} endedAt={row.original.endedAt} status={row.original.status} />
    ),
  },
  {
    accessorKey: "distanceKm",
    header: "Distance",
    enableSorting: false,
    meta: { className: "text-right" },
    cell: ({ getValue }) => <span className="tabular-nums">{distanceLabel(getValue() as number | null)}</span>,
  },
  {
    accessorKey: "stopCount",
    header: "Stops",
    meta: { className: "text-right" },
    cell: ({ getValue }) => <span className="tabular-nums">{getValue() as number}</span>,
  },
  {
    accessorKey: "photoCount",
    header: "Photos",
    meta: { className: "text-right" },
    cell: ({ getValue }) => <PhotoCountBadge n={getValue() as number} />,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <LogisticsStatusPill status={row.original.status} endedAt={row.original.endedAt} />,
  },
];

/** Skeleton cells mirroring the run columns. */
export const runSkeleton: SkeletonCell[] = [
  () => <Skeleton className="h-4 w-24" />,
  () => (
    <>
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-1.5 h-3 w-20" />
    </>
  ),
  () => (
    <>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-1.5 h-3 w-12" />
    </>
  ),
  () => <Skeleton className="h-4 w-14" />,
  () => <Skeleton className="h-4 w-8" />,
  () => <Skeleton className="h-5 w-10 rounded-full" />,
  () => <Skeleton className="h-5 w-16 rounded-full" />,
];
