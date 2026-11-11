import { getApiAuthHeaders } from "../auth/server-session";
import { serverApiFetch } from "../../lib/server-api";

export interface Customer {
  id: string;
  customerCode: string;
  legalName: string;
  tradeName: string | null;
  customerName: string | null;
  customerType: string;
  segment: string | null;
  phone: string | null;
  alternativePhone: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  aadharNumber: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressPincode: string | null;
  addressLandmark: string | null;
  email: string | null;
  customerGrade: string | null;
  creditLimit: number;
  creditDays: number;
  paymentStatus: string;
  kycStatus: string;
  approvalStatus: string;
  status: string;
  createdBy: string | null;
  salesExecutiveName: string | null;
  collectionDues: number;
  /** Whether the customer has any invoice or collection — distinguishes a
   *  genuinely-settled ₹0 from a customer with no business (shown as "—"). */
  hasBusiness: boolean;
  /** Days the oldest still-unpaid invoice has been outstanding; null = none. */
  oldestUnpaidDays: number | null;
}

interface ApiSuccess<T> {
  success: true;
  data: T;
}


async function fetchApi(path: string): Promise<Response> {
  const authHeaders = await getApiAuthHeaders();
  return serverApiFetch(path, { cache: "no-store", headers: authHeaders });
}

export async function listCustomers(params?: {
  status?: string;
  search?: string;
  customerGrade?: string;
}): Promise<Customer[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.search) qs.set("search", params.search);
  if (params?.customerGrade) qs.set("customerGrade", params.customerGrade);

  const query = qs.toString();
  const response = await fetchApi(`/customers${query ? `?${query}` : ""}`);

  if (!response.ok) {
    throw new Error(`Customers API failed with ${response.status}`);
  }

  const body = (await response.json()) as ApiSuccess<Customer[]>;
  return body.data;
}

export async function getCustomer(id: string): Promise<Customer> {
  const response = await fetchApi(`/customers/${id}`);

  if (!response.ok) {
    throw new Error(`Customer API failed with ${response.status}`);
  }

  const body = (await response.json()) as ApiSuccess<Customer>;
  return body.data;
}

export function getActionConfig(): { apiBaseUrl: string } {
  return {
    apiBaseUrl:
      process.env.SRI_APARAJITA_API_BASE_URL ?? "http://localhost:8787/api/v1",
  };
}
