// Fulfillment ladder chips + labels — mirror the customer page's "Last 5 orders".
export const STATUS_CHIP: Record<string, string> = {
  ordered: "bg-slate-100 text-slate-700",
  partially_invoiced: "bg-amber-100 text-amber-800",
  invoiced: "bg-blue-100 text-blue-700",
  partially_delivered: "bg-amber-100 text-amber-800",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};
export const FULFILLMENT_LABEL: Record<string, string> = {
  ordered: "Ordered",
  partially_invoiced: "Partially invoiced",
  invoiced: "Invoiced",
  partially_delivered: "Partially delivered",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function packLabel(litres: number): string {
  return litres > 0 && litres < 1 ? `${Math.round(litres * 1000)} mL` : `${litres} L`;
}

export function dateLabel(iso: string | null): string {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
