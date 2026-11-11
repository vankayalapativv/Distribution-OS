import type { ColumnDef } from "@tanstack/react-table";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/format";
import { paymentModeLabel, type Expenditure } from "./expenditures-api";
import { AmountCell, CategoryCell } from "./expenditure-cells";
import { ExpenditureRowActions } from "./expenditure-row-actions";

// Re-exported so existing imports (`./expenditures-columns`) keep working.
export { expenditureSkeleton } from "./expenditures-skeleton";

/** Compulsory vs variable → pill tones. */
export const TYPE_CLASSES: Record<string, string> = {
  compulsory: "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20",
  variable: "bg-slate-100 text-slate-700 ring-1 ring-slate-600/20",
};

const baseColumns: ColumnDef<Expenditure>[] = [
  {
    accessorKey: "expenditureCode",
    header: "Code",
    cell: ({ getValue }) => (
      <span className="font-mono text-xs font-medium">{getValue() as string}</span>
    ),
  },
  {
    accessorKey: "expenditureDate",
    header: "Date",
    cell: ({ getValue }) => (
      <span className="text-muted-foreground">{formatDate(getValue() as string)}</span>
    ),
  },
  {
    accessorKey: "categoryName",
    header: "Category",
    cell: ({ row }) => <CategoryCell entry={row.original} />,
  },
  {
    id: "type",
    accessorKey: "type",
    header: "Type",
    enableSorting: false,
    cell: ({ getValue }) => <StatusBadge status={getValue() as string} tones={TYPE_CLASSES} />,
  },
  {
    id: "userName",
    accessorKey: "userName",
    header: "For",
    enableSorting: false,
    cell: ({ getValue }) => (
      <span className="text-muted-foreground">{(getValue() as string) ?? "—"}</span>
    ),
  },
  {
    id: "paymentMode",
    accessorKey: "paymentMode",
    header: "Mode",
    enableSorting: false,
    cell: ({ getValue }) => (
      <span className="text-muted-foreground">{paymentModeLabel(getValue() as string | null)}</span>
    ),
  },
  {
    accessorKey: "amount",
    header: "Amount",
    meta: { className: "text-right" },
    cell: ({ row }) => <AmountCell entry={row.original} />,
  },
];

/**
 * Columns plus a trailing actions cell. The row itself is clickable, so the
 * action buttons stop propagation to avoid also opening the row.
 */
export function buildExpenditureColumns({
  onEdit,
  onDelete,
}: {
  onEdit: (entry: Expenditure) => void;
  onDelete: (entry: Expenditure) => void;
}): ColumnDef<Expenditure>[] {
  return [
    ...baseColumns,
    {
      id: "actions",
      header: "",
      enableSorting: false,
      meta: { className: "text-right" },
      cell: ({ row }) => <ExpenditureRowActions entry={row.original} onEdit={onEdit} onDelete={onDelete} />,
    },
  ];
}
