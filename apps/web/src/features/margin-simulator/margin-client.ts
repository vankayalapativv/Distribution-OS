import { apiRequest, type ActionConfig } from "@/lib/api-client";
import type { MarginSim } from "./margin-api";

export interface MarginSimBody {
  productId: string | null;
  productName: string;
  packSize: number;
  mrp: number | null;
  dlp: number;
  expensePerLiter: number;
  schemePerLiter: number;
  coupon: number | null;
  mop: number;
}

export function createSim(config: ActionConfig, body: MarginSimBody): Promise<{ row: MarginSim }> {
  return apiRequest(config, "POST", "/margin-simulations", { ...body });
}

export function updateSim(config: ActionConfig, id: string, body: MarginSimBody): Promise<{ row: MarginSim }> {
  return apiRequest(config, "PATCH", `/margin-simulations/${id}`, { ...body });
}

export function deleteSim(config: ActionConfig, id: string): Promise<{ ok: boolean }> {
  return apiRequest(config, "DELETE", `/margin-simulations/${id}`);
}
