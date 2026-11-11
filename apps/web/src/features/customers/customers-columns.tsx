import type { ColumnDef } from "@tanstack/react-table";
import { StatusBadge } from "@/components/status-badge";
import { CUSTOMER_TYPE_LABELS as TYPE_LABELS, SegmentIcons } from "@/components/segment-icons";
import { rupeesExact } from "@/lib/format";
import type { Customer } from "./customers-api";

// Skeleton moved out for the ≤100-line rule; re-exported so `./customers-columns`
// imports keep working.
export { customerSkeleton } from "./customers-columns-skeleton";

const STATUS_TONES: Record<string, string> = {
  active: "bg-secondary text-secondary-foreground",
  inactive: "bg-muted text-muted-foreground",
  suspended: "bg-destructive/10 text-destructive",
};

const muted = (v: string) => <span className="text-muted-foreground">{v}</span>;

export const customerColumns: ColumnDef<Customer>[] = [
  {
    accessorKey: "customerCode",
    header: "Code",
    cell: ({ getValue }) => (
      <span className="font-mono text-xs text-muted-foreground">{getValue() as string}</span>
    ),
  },
  {
    accessorKey: "legalName",
    header: "Customer",
    // Name + segment icons on the first line; city · executive · type below;
    // phone last. (The standalone Sales Executive / Type / Segment columns were
    // folded in here on 2026-08-20.)
    cell: ({ row }) => {
      const c = row.original;
      const meta = [c.addressCity, c.salesExecutiveName, TYPE_LABELS[c.customerType] ?? c.customerType]
        .filter(Boolean)
        .join(" · ");
      return (
        <div>
          <div className="flex items-center gap-1.5">
            <p className="font-medium">{c.legalName}</p>
            <SegmentIcons segment={c.segment} />
          </div>
          {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
          {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
        </div>
      );
    },
  },
  {
    id: "oldestUnpaidDays",
    accessorFn: (row) => row.oldestUnpaidDays ?? -1,
    header: "Oldest unpaid",
    // Age of the oldest still-unpaid invoice; amber past 45 days, else muted.
    cell: ({ row }) => {
      const d = row.original.oldestUnpaidDays;
      if (d == null) return muted("—");
      const label = `${d} day${d === 1 ? "" : "s"}`;
      return <span className={d > 45 ? "font-medium text-amber-700" : "text-muted-foreground"}>{label}</span>;
    },
  },
  {
    id: "collectionDues",
    accessorFn: (row) => row.collectionDues,
    header: "Collection Dues",
    // Signed net balance = the ledger's Total Debit Balance: > 0 = owes us
    // (Dr, red), < 0 = customer in credit / overpaid (Cr, green). Net 0 =
    // settled (₹0) if the customer has any business; "—" when there's no
    // business (no invoices or collections) at all.
    cell: ({ row }) => {
      const net = row.original.collectionDues;
      if (net > 0) {
        return <span className="font-medium text-red-600">{rupeesExact(net)}</span>;
      }
      if (net < 0) {
        return <span className="font-medium text-green-700">{rupeesExact(-net)} Cr</span>;
      }
      return row.original.hasBusiness === false
        ? muted("—")
        : <span className="text-muted-foreground">{rupeesExact(0)}</span>;
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ getValue }) => <StatusBadge status={getValue() as string} tones={STATUS_TONES} />,
  },
];
