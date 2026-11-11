/** Faint per-status row wash (subtle — matches each badge's hue). Cancelled reads
 *  red; the rest tint by ladder stage. The "new since you last looked" highlight
 *  takes precedence over these (see the list's rowClassName). */
export const FULFILLMENT_ROW_BG: Record<string, string> = {
  ordered: "bg-slate-50/70",
  partially_invoiced: "bg-indigo-50/50",
  invoiced: "bg-blue-50/50",
  partially_delivered: "bg-amber-50/50",
  delivered: "bg-green-50/50",
  partially_returned: "bg-orange-50/50",
  returned: "bg-rose-50/50",
  cancelled: "bg-red-50/60",
};

/** Header-dropdown filter options (adds "All" + "Cancelled" to the ladder stages). */
export const FULFILLMENT_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "ordered", label: "Ordered" },
  { value: "partially_invoiced", label: "Partially invoiced" },
  { value: "invoiced", label: "Invoiced" },
  { value: "partially_delivered", label: "Partially delivered" },
  { value: "delivered", label: "Delivered" },
  { value: "partially_returned", label: "Partially returned" },
  { value: "returned", label: "Returned" },
  { value: "cancelled", label: "Cancelled" },
];
