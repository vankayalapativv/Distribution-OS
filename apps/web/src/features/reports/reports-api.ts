/**
 * Reports feature — client fetch for the Reports page. Consumes
 * `GET /api/v1/reports?from=&to=&report=` (payload inside the standard
 * {success,data,meta} envelope; `apiGet` unwraps `data`). Types live in
 * reports-types.ts.
 */
import { apiGet, type ActionConfig } from "@/lib/api-client";
import type {
  ReportKey,
  ReportPeriod,
  ReportRange,
  ReportSlice,
  ReportsSummary,
} from "./reports-types";

export type { ReportKey, ReportRange, ReportSlice, ReportsSummary } from "./reports-types";

/** `brand` narrows the product/oil reports (""/"all" = every brand). */
function withRange(range: ReportRange, report: string, brand?: string): string {
  const params = new URLSearchParams({ from: range.from, to: range.to, report });
  if (brand && brand !== "all") params.set("brand", brand);
  return `/reports?${params.toString()}`;
}

/** Light summary for the overview (loads on page open + range/brand change). */
export function fetchSummary(
  config: ActionConfig,
  range: ReportRange,
  brand?: string,
): Promise<{ period: ReportPeriod; generatedAt: string; summary: ReportsSummary }> {
  return apiGet(config, withRange(range, "summary", brand));
}

/** One report's detail — fetched when its card is opened. */
export function fetchReport(
  config: ActionConfig,
  range: ReportRange,
  key: ReportKey,
  brand?: string,
): Promise<ReportSlice> {
  return apiGet<ReportSlice>(config, withRange(range, key, brand));
}

/** Live oil brands (companies) — only those with at least one product. Drives the
 *  dedicated per-brand report sections, so new brands appear automatically. */
export async function fetchBrands(config: ActionConfig): Promise<string[]> {
  const { brands } = await apiGet<{ brands: string[] }>(config, "/brands?category=oils");
  return brands;
}

/** Real per-brand numbers for the dedicated brand report cards. */
export interface BrandTeaser {
  oilLitres: number;
  pendingOrders: number;
  pendingLitres: number;
  billedInvoices: number;
  cancelledLitres: number;
  returnedLitres: number;
}

export async function fetchBrandsSummary(
  config: ActionConfig,
  range: ReportRange,
): Promise<Record<string, BrandTeaser>> {
  const params = new URLSearchParams({ from: range.from, to: range.to });
  const { brands } = await apiGet<{ brands: Record<string, BrandTeaser> }>(config, `/reports/brands-summary?${params}`);
  return brands;
}
