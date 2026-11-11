import { getApiAuthHeaders } from "../auth/server-session";
import { serverApiFetch } from "../../lib/server-api";
import { getProductsActionConfig, listManagedProducts } from "../products/products-api";

/** A saved margin scenario (from `/margin-simulations`). */
export interface MarginSim {
  id: string;
  productId: string | null;
  productName: string;
  packSize: number;
  mrp: number | null;
  dlp: number;
  expensePerLiter: number;
  schemePerLiter: number;
  coupon: number | null;
  mop: number;
  marginPerPack: number;
  marginPerLiter: number;
  createdAt: string;
  updatedAt: string;
}

/** Oil product for the picker — just id/name + its pack sizes (prices are entered
 *  per scenario in the simulator, not stored on the product). */
export interface OilProduct {
  id: string;
  productName: string;
  packs: { packSize: number }[];
}

interface ApiSuccess<T> {
  success: true;
  data: T;
}

export async function loadSimulations(): Promise<MarginSim[]> {
  const authHeaders = await getApiAuthHeaders();
  const res = await serverApiFetch("/margin-simulations", { cache: "no-store", headers: authHeaders });
  if (!res.ok) throw new Error(`Margin simulations API failed with ${res.status}`);
  const body = (await res.json()) as ApiSuccess<{ rows: MarginSim[] }>;
  return body.data.rows;
}

/** Oils only (products that have priced packs). */
export async function loadOilProducts(): Promise<OilProduct[]> {
  const products = await listManagedProducts();
  return products
    .filter((p) => (p.packs ?? []).length > 0)
    .map((p) => ({
      id: p.id,
      productName: p.productName,
      packs: (p.packs ?? []).map((pk) => ({ packSize: pk.packSize })),
    }));
}

export function getMarginActionConfig(): { apiBaseUrl: string } {
  return getProductsActionConfig();
}
