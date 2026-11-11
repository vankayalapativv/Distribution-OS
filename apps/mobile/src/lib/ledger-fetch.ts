/**
 * Fetch a customer's FULL (all-time) ledger (online-only). The screen slices
 * this whole statement to the chosen date range on-device, so range switching
 * stays instant; a fetch failure surfaces as the screen's error state.
 */
import { apiFetch } from "./api";
import { ymd } from "./ledger-presets";
import type { LedgerData } from "./ledger";

export async function fetchFullLedger(
  customerId: string,
  token: string | null,
): Promise<LedgerData> {
  const to = ymd(new Date());
  return apiFetch<LedgerData>(`/customers/${customerId}/ledger?from=2000-01-01&to=${to}`, {
    token,
  });
}
