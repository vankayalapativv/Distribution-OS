import { getApiAuthHeaders } from "../auth/server-session";
import { serverApiFetch } from "../../lib/server-api";
import type { Collection, CollectionDetail, Collector } from "./collections-types";

// Re-exported so existing `from "./collections-api"` imports keep working; the
// type definitions now live in ./collections-types.
export type {
  Collection, CollectionDetail, CollectionAllocation, CollectionProof, Collector,
} from "./collections-types";

interface ApiSuccess<T> {
  success: true;
  data: T;
}


async function fetchApi(path: string): Promise<Response> {
  const authHeaders = await getApiAuthHeaders();
  return serverApiFetch(path, { cache: "no-store", headers: authHeaders });
}

export async function listCollections(params?: {
  status?: string;
  customerId?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<Collection[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.customerId) qs.set("customerId", params.customerId);
  if (params?.fromDate) qs.set("fromDate", params.fromDate);
  if (params?.toDate) qs.set("toDate", params.toDate);

  const query = qs.toString();
  const response = await fetchApi(`/collections${query ? `?${query}` : ""}`);

  if (!response.ok) {
    throw new Error(`Collections API failed with ${response.status}`);
  }

  const body = (await response.json()) as ApiSuccess<Collection[]>;
  return body.data;
}

export async function getCollection(id: string): Promise<CollectionDetail> {
  const response = await fetchApi(`/collections/${id}`);

  if (!response.ok) {
    throw new Error(`Collection API failed with ${response.status}`);
  }

  const body = (await response.json()) as ApiSuccess<CollectionDetail>;
  return body.data;
}

/** Active users who can be credited as the collector on a web collection. */
export async function listCollectors(): Promise<Collector[]> {
  const response = await fetchApi("/collections/collectors");
  if (!response.ok) {
    throw new Error(`Collectors API failed with ${response.status}`);
  }
  const body = (await response.json()) as ApiSuccess<Collector[]>;
  return body.data;
}

export function getActionConfig(): { apiBaseUrl: string } {
  return {
    apiBaseUrl:
      process.env.SRI_APARAJITA_API_BASE_URL ?? "http://localhost:8787/api/v1",
  };
}
