import { getApiAuthHeaders } from "../auth/server-session";
import { serverApiFetch } from "../../lib/server-api";
import type { ManagedProduct } from "./products-types";

// Re-exported so existing `from "./products-api"` imports keep working; the type
// definitions now live in ./products-types.
export type { ProductPack, ProductUnit, ManagedProduct } from "./products-types";

interface ApiSuccess<T> {
  success: true;
  data: T;
}

async function fetchApi(path: string): Promise<Response> {
  const authHeaders = await getApiAuthHeaders();
  return serverApiFetch(path, { cache: "no-store", headers: authHeaders });
}

export async function listManagedProducts(): Promise<ManagedProduct[]> {
  const response = await fetchApi("/products");
  if (!response.ok) throw new Error(`Products API failed with ${response.status}`);
  const body = (await response.json()) as ApiSuccess<{ products: ManagedProduct[] }>;
  return body.data.products;
}

export function getProductsActionConfig(): { apiBaseUrl: string } {
  return { apiBaseUrl: process.env.SRI_APARAJITA_API_BASE_URL ?? "http://localhost:8787/api/v1" };
}
