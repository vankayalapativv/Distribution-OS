/**
 * Shared types, table class tokens, and bespoke formatters for the dashboard
 * analytics tables (oils / customers). Formatters that differ from the
 * shared `@/lib/format` set (pack label, "never" date) live here. Pure — no JSX.
 */

export interface OilSku {
  productId: string;
  productName: string;
  packSizeLitres: number;
  litres: number;
  quantity: number;
  orders: number;
  customers: number;
}
export interface OilSegment {
  segment: string;
  litres: number;
  quantity: number;
  orders: number;
  customers: number;
  skus: OilSku[];
}
export interface CustomerRow {
  customerId: string;
  customerName: string;
  customerCode: string | null;
  salesExecutive: string | null;
  litres: number;
  orders: number;
  collected: number;
  pendingCollections: number;
  lastOrderDate: string | null;
}

export type CustomerSort = { key: keyof CustomerRow; dir: "asc" | "desc" };

export const TH =
  "px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap";
export const TD = "px-4 py-3 tabular-nums";

export function packLabel(l: number): string {
  return l > 0 && l < 1 ? `${Math.round(l * 1000)} mL` : `${l} L`;
}

/** Day-Month, or "never" when there's no date (differs from format's "—"). */
export function dateLabel(iso: string | null): string {
  if (!iso) return "never";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata", // single-client IST; consistent SSR + client
  });
}
