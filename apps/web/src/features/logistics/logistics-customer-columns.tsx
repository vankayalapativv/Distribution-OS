import type { ColumnDef } from "@tanstack/react-table";
import { Skeleton } from "@/components/ui/skeleton";
import type { SkeletonCell } from "@/components/data-table/data-table";
import { formatDate } from "@/lib/format";
import { PhotoCountBadge } from "./logistics-media";
import type { DeliveryCustomerRow } from "./logistics-api";

/** "By customer" columns — one row per customer with delivery + photo counts. */
export const customerColumns: ColumnDef<DeliveryCustomerRow>[] = [
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
    accessorKey: "area",
    header: "Area",
    cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string) ?? "—"}</span>,
  },
  {
    accessorKey: "deliveryCount",
    header: "Deliveries",
    cell: ({ getValue }) => (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 tabular-nums">
        {getValue() as number}
      </span>
    ),
  },
  {
    accessorKey: "lastDeliveryDate",
    header: "Last delivery",
    cell: ({ getValue }) => <span className="tabular-nums">{formatDate(getValue() as string)}</span>,
  },
  {
    accessorKey: "photoCount",
    header: "Photos",
    cell: ({ getValue }) => <PhotoCountBadge n={getValue() as number} />,
  },
];

/** Skeleton cells mirroring the customer columns. */
export const customerSkeleton: SkeletonCell[] = [
  () => (
    <>
      <Skeleton className="h-4 w-44" />
      <Skeleton className="mt-1.5 h-3 w-16" />
    </>
  ),
  () => <Skeleton className="h-4 w-24" />,
  () => <Skeleton className="h-5 w-8 rounded-full" />,
  () => <Skeleton className="h-4 w-24" />,
  () => <Skeleton className="h-5 w-10 rounded-full" />,
];
