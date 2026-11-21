import { apiFetch } from "./api";

/** Available-stock shapes returned by `GET /stock/available` (SE + in-app admin,
 *  read-only). Product → pack → per-godown on-hand quantity. */
export interface StockGodown {
  id: string;
  name: string;
}
export interface StockPackGodown {
  locationId: string;
  qtyUnits: number;
}
export interface StockPack {
  packSizeLitres: number;
  totalUnits: number;
  byGodown: StockPackGodown[];
}
export interface StockProduct {
  productId: string;
  productName: string;
  brand: string | null;
  segment: string | null;
  unit: "litres" | "quantity";
  totalUnits: number;
  packs: StockPack[];
}
export interface AvailableStock {
  godowns: StockGodown[];
  products: StockProduct[];
}

/** All on-hand stock in one fetch; the Stock screen filters/expands client-side. */
export async function fetchAvailableStock(token: string | null): Promise<AvailableStock> {
  return apiFetch<AvailableStock>("/stock/available", { token });
}

/** "5 L" for litres packs; "pcs" for piece-sold products (sentinel pack = 1). */
export function packLabel(packSizeLitres: number, unit: StockProduct["unit"]): string {
  if (unit === "quantity") return "pcs";
  return `${Number.isInteger(packSizeLitres) ? packSizeLitres : packSizeLitres.toFixed(1)} L`;
}
