import type { ColumnDef } from "@tanstack/react-table";
import { Skeleton } from "@/components/ui/skeleton";
import type { SkeletonCell } from "@/components/data-table/data-table";
import type { ManagedProduct } from "./products-api";
import { RowActions, type CatalogueHandlers } from "./products-row-actions";

/** Oil (product) columns — name, brand, segments, pack sizes, and a row menu. */
export function oilColumns(h: CatalogueHandlers<ManagedProduct>): ColumnDef<ManagedProduct>[] {
  return [
    {
      accessorKey: "productName",
      header: "Product Name",
      cell: ({ getValue }) => <span className="font-medium">{getValue() as string}</span>,
    },
    {
      accessorKey: "brand",
      header: "Brand",
      enableSorting: false,
      cell: ({ getValue }) => {
        const b = getValue() as string;
        return b ? <span>{b}</span> : <span className="text-xs text-muted-foreground">—</span>;
      },
    },
    {
      id: "segments",
      header: "Segments",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.segments.length === 0 ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            row.original.segments.map((seg) => (
              <span key={seg} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{seg}</span>
            ))
          )}
        </div>
      ),
    },
    {
      id: "packs",
      header: "Pack sizes",
      enableSorting: false,
      cell: ({ row }) => {
        if (row.original.unit === "quantity") {
          return <span className="text-xs text-muted-foreground">By the piece</span>;
        }
        const packs = row.original.packs ?? [];
        return (
          <div className="flex flex-wrap gap-1">
            {packs.length === 0 ? (
              <span className="text-xs text-muted-foreground">—</span>
            ) : (
              packs.map((p) => (
                <span key={p.packSize} className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {p.packSize} L
                </span>
              ))
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      meta: { className: "text-right" },
      cell: ({ row }) => (
        <div className="flex justify-end">
          {h.canManage ? <RowActions row={row.original} onEdit={h.onEdit} onDelete={h.onDelete} label="product" /> : <span className="text-xs text-muted-foreground">—</span>}
        </div>
      ),
    },
  ];
}

/** Skeleton cells mirroring the oil columns (name, brand, segments, packs, actions). */
export const oilSkeleton: SkeletonCell[] = [
  () => <Skeleton className="h-4 w-40" />,
  () => <Skeleton className="h-4 w-20" />,
  () => <div className="flex gap-1"><Skeleton className="h-5 w-12 rounded-full" /><Skeleton className="h-5 w-16 rounded-full" /></div>,
  () => <div className="flex gap-1"><Skeleton className="h-5 w-10 rounded-full" /><Skeleton className="h-5 w-10 rounded-full" /></div>,
  () => <div className="flex justify-end"><Skeleton className="h-4 w-4" /></div>,
];
