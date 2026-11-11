import type { ColumnDef } from "@tanstack/react-table";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, rupeesExact } from "@/lib/format";
import type { Collection } from "./collections-api";

export { collectionSkeleton } from "./collections-columns-skeleton";

/** Accountant approval status → pill tones. */
export const STATUS_CLASSES: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-600/20",
  verified: "bg-green-50 text-green-700 ring-1 ring-green-600/20",
  rejected: "bg-red-50 text-red-700 ring-1 ring-red-600/20",
};

export const PAYMENT_MODE_LABELS: Record<string, string> = {
  cash: "Cash",
  cheque: "Cheque",
  upi: "UPI",
  neft_rtgs: "NEFT/RTGS",
};

export const collectionColumns: ColumnDef<Collection>[] = [
  {
    accessorKey: "collectionCode",
    header: "Code",
    cell: ({ getValue }) => (
      <span className="font-mono text-xs font-medium">{getValue() as string}</span>
    ),
  },
  {
    accessorKey: "customerName",
    header: "Customer",
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.customerName ?? "—"}</p>
        {row.original.customerCity && (
          <p className="text-xs text-muted-foreground">{row.original.customerCity}</p>
        )}
        {row.original.customerPhone && (
          <p className="text-xs text-muted-foreground">{row.original.customerPhone}</p>
        )}
      </div>
    ),
  },
  {
    accessorKey: "collectionDate",
    header: "Date",
    cell: ({ getValue }) => (
      <span className="text-muted-foreground">{formatDate(getValue() as string)}</span>
    ),
  },
  {
    id: "paymentMode",
    accessorKey: "paymentMode",
    header: "Mode",
    enableSorting: false,
    cell: ({ getValue }) => (
      <span className="text-muted-foreground">
        {PAYMENT_MODE_LABELS[getValue() as string] ?? (getValue() as string)}
      </span>
    ),
  },
  {
    id: "paymentReferenceNumber",
    accessorKey: "paymentReferenceNumber",
    header: "Reference No.",
    enableSorting: false,
    cell: ({ getValue }) => {
      const ref = getValue() as string | null;
      return ref ? (
        <span className="font-mono text-xs">{ref}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    },
  },
  {
    accessorKey: "collectionAmount",
    header: "Amount",
    meta: { className: "text-right" },
    cell: ({ getValue }) => (
      <span className="font-medium">{rupeesExact(Number(getValue()))}</span>
    ),
  },
  {
    id: "collectedByName",
    accessorKey: "collectedByName",
    header: "Collected By",
    enableSorting: false,
    cell: ({ getValue }) => (
      <span className="text-muted-foreground">{(getValue() as string) ?? "—"}</span>
    ),
  },
  {
    accessorKey: "accountantApprovalStatus",
    header: "Status",
    cell: ({ getValue }) => <StatusBadge status={getValue() as string} tones={STATUS_CLASSES} />,
  },
];
