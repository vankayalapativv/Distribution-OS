/** Order-status pill palette — kept for the customer-page orders tab. */
export const STATUS_CLASSES: Record<string, string> = {
  approved: "bg-secondary text-secondary-foreground",
  pending: "bg-yellow-100 text-yellow-800",
  draft: "bg-muted text-muted-foreground",
  rejected: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

/** Fulfillment stage pill palette (Ordered → Partially invoiced → Invoiced →
 *  Partially delivered → Delivered). Shared by the Orders list + customer tab. */
export const FULFILLMENT_TONES: Record<string, string> = {
  ordered: "bg-slate-50 text-slate-600 ring-1 ring-slate-500/20",
  partially_invoiced: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/20",
  invoiced: "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20",
  partially_delivered: "bg-amber-50 text-amber-800 ring-1 ring-amber-600/20",
  delivered: "bg-green-50 text-green-700 ring-1 ring-green-600/20",
  partially_returned: "bg-orange-50 text-orange-700 ring-1 ring-orange-600/20",
  returned: "bg-rose-50 text-rose-700 ring-1 ring-rose-600/20",
  partially_cancelled: "bg-purple-50 text-purple-700 ring-1 ring-purple-600/20",
  cancelled: "bg-red-50 text-red-700 ring-1 ring-red-600/20",
};

/** Display labels (the badge otherwise title-cases the raw key with an underscore). */
export const FULFILLMENT_LABELS: Record<string, string> = {
  ordered: "Ordered",
  partially_invoiced: "Partially invoiced",
  invoiced: "Invoiced",
  partially_delivered: "Partially delivered",
  delivered: "Delivered",
  partially_returned: "Partially returned",
  returned: "Returned",
  partially_cancelled: "Partially cancelled",
  cancelled: "Cancelled",
};

/** The computed fulfillment-stage pill (Ordered → … → Delivered). Null defaults
 *  to "ordered" (nothing billed yet). Shared by the Orders list and the customer
 *  Orders tab so both read the same ladder. */
export function FulfillmentBadge({ status }: { readonly status: string | null | undefined }) {
  const s = status ?? "ordered";
  return (
    <span
      className={`inline-flex w-fit items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
        FULFILLMENT_TONES[s] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {FULFILLMENT_LABELS[s] ?? s}
    </span>
  );
}
