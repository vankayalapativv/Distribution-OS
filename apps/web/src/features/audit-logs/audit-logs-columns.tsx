import type { ColumnDef } from "@tanstack/react-table";
import { Skeleton } from "@/components/ui/skeleton";
import type { SkeletonCell } from "@/components/data-table/data-table";
import { formatDateTime } from "@/lib/format";
import { ActorCell } from "./audit-actor";
import type { AuditLog } from "./audit-logs-api";

export const auditColumns: ColumnDef<AuditLog>[] = [
  {
    accessorKey: "createdAt",
    header: "When",
    cell: ({ getValue }) => (
      <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(getValue() as string)}</span>
    ),
  },
  {
    accessorKey: "actorName",
    header: "Who",
    enableSorting: false,
    cell: ({ row }) => <ActorCell log={row.original} />,
  },
  {
    accessorKey: "action",
    header: "Action",
    cell: ({ getValue }) => (
      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
        {getValue() as string}
      </span>
    ),
  },
  {
    id: "record",
    header: "Record",
    enableSorting: false,
    cell: ({ row }) => {
      const a = row.original;
      if (!a.entityLabel && !a.entityType) return <span className="text-muted-foreground">—</span>;
      return (
        <span className="flex flex-col">
          {a.entityLabel ? <span className="font-medium">{a.entityLabel}</span> : null}
          {a.entityType ? <span className="text-xs text-muted-foreground">{a.entityType}</span> : null}
        </span>
      );
    },
  },
  {
    accessorKey: "summary",
    header: "Summary",
    enableSorting: false,
    cell: ({ getValue }) => <span className="text-foreground">{getValue() as string}</span>,
  },
];

/** Skeleton cells mirroring the audit columns. */
export const auditSkeleton: SkeletonCell[] = [
  () => <Skeleton className="h-4 w-32" />,
  () => (
    <div className="flex flex-col gap-1">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-16 rounded-full" />
    </div>
  ),
  () => <Skeleton className="h-5 w-28 rounded" />,
  () => <Skeleton className="h-4 w-20" />,
  () => <Skeleton className="h-4 w-72" />,
];
