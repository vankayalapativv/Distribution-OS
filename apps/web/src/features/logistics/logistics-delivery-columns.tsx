import type { ColumnDef } from "@tanstack/react-table";
import { Skeleton } from "@/components/ui/skeleton";
import type { SkeletonCell } from "@/components/data-table/data-table";
import { formatDate } from "@/lib/format";
import { fmtTime, PhotoCountBadge } from "./logistics-media";
import type { DeliveryStopRow } from "./logistics-api";

/** "By delivery" columns — one row per delivery stop. */
export const deliveryColumns: ColumnDef<DeliveryStopRow>[] = [
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) => (
      <div className="tabular-nums">
        {formatDate(row.original.date)}
        <div className="text-[11px] text-muted-foreground">{fmtTime(row.original.createdAt)}</div>
      </div>
    ),
  },
  {
    accessorKey: "customerName",
    header: "Customer",
    cell: ({ row }) => (
      <div>
        <div className="text-sm font-medium">{row.original.customerName ?? "—"}</div>
        <div className="font-mono text-[11px] text-muted-foreground">{row.original.customerCode ?? ""}</div>
      </div>
    ),
  },
  {
    accessorKey: "driverName",
    header: "Driver · Vehicle",
    cell: ({ row }) => (
      <div>
        {row.original.driverName ?? "—"}
        <div className="text-[11px] text-muted-foreground">{row.original.vehicleNumber ?? ""}</div>
      </div>
    ),
  },
  {
    id: "location",
    header: "Location",
    enableSorting: false,
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground tabular-nums">
        {row.original.latitude != null && row.original.longitude != null
          ? `${row.original.latitude.toFixed(4)}, ${row.original.longitude.toFixed(4)}`
          : "—"}
      </span>
    ),
  },
  {
    accessorKey: "photoCount",
    header: "Photos",
    cell: ({ getValue }) => <PhotoCountBadge n={getValue() as number} />,
  },
];

/** Skeleton cells mirroring the delivery columns. */
export const deliverySkeleton: SkeletonCell[] = [
  () => (
    <>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-1.5 h-3 w-14" />
    </>
  ),
  () => (
    <>
      <Skeleton className="h-4 w-44" />
      <Skeleton className="mt-1.5 h-3 w-16" />
    </>
  ),
  () => (
    <>
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-1.5 h-3 w-20" />
    </>
  ),
  () => <Skeleton className="h-4 w-28" />,
  () => <Skeleton className="h-5 w-10 rounded-full" />,
];
