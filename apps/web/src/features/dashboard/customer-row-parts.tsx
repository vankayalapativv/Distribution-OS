import Link from "next/link";
import { litresLabel, type CustomerRow } from "./metrics-helpers";

export type VisitOrder = { id: string; code: string; litres: number };
export type VisitCollection = { id: string; code: string; amount: number };

/** Order outcome as "45 L" — oil litres. */
export function orderMetric(o: VisitOrder): string {
  const parts: string[] = [];
  if (o.litres > 0) parts.push(litresLabel(o.litres));
  return parts.join(" · ") || "—";
}

export const chipClass =
  "group inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-xs transition-colors hover:border-primary hover:bg-primary/5";

function statusTone(status: string): string {
  if (status === "verified") return "bg-green-50 text-green-700";
  if (status === "rejected") return "bg-red-50 text-red-700";
  return "bg-amber-50 text-amber-800";
}

export function StatusChip({ status }: Readonly<{ status: string }>) {
  const tone = statusTone(status);
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${tone}`}>{status}</span>
  );
}

/** Customer legal name — links to the customer page when we have an id. */
export function CustomerName({ row }: Readonly<{ row: CustomerRow }>) {
  const id = typeof row.customerId === "string" ? row.customerId : "";
  const name = String(row.customerName);
  if (!id) {
    return <span className="block text-sm font-semibold text-foreground">{name}</span>;
  }
  return (
    <Link
      href={`/customers/${id}`}
      className="block text-sm font-semibold text-foreground transition-colors hover:text-primary hover:underline"
    >
      {name}
    </Link>
  );
}
