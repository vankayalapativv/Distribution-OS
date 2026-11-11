// Direct API senders for the logistics delivery writes (online-only). Thin
// wrappers over apiFetch, with the fetcher injectable so they're unit-testable
// without a network. A run's server id comes back from `sendStartRun`, so
// stops/end target it immediately.

import { apiFetch } from "./api";

/** A record returned by the delivery endpoints (always carries an `id`). */
export type DeliveryRecord = { id: string; [key: string]: unknown };

/** apiFetch-shaped call, injectable for tests. */
export type DeliveryFetcher = <T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null },
) => Promise<T>;

export interface StartRunBody {
  vehicleNumber: string;
  startOdometer: number;
  clientUuid: string;
}

export interface AddStopBody {
  runClientUuid: string;
  customerId: string;
  latitude: number | null;
  longitude: number | null;
  invoiceId: string | null;
  clientUuid: string;
}

export interface EndRunBody {
  runClientUuid: string;
  endOdometer: number;
}

export function sendStartRun(
  body: StartRunBody,
  token: string | null,
  fetcher: DeliveryFetcher = apiFetch,
): Promise<DeliveryRecord> {
  return fetcher<DeliveryRecord>("/deliveries/runs/start", { method: "POST", body, token });
}

export function sendAddStop(
  runServerId: string,
  body: AddStopBody,
  token: string | null,
  fetcher: DeliveryFetcher = apiFetch,
): Promise<DeliveryRecord> {
  return fetcher<DeliveryRecord>(`/deliveries/runs/${runServerId}/stops`, {
    method: "POST",
    body,
    token,
  });
}

export function sendEndRun(
  runServerId: string,
  body: EndRunBody,
  token: string | null,
  fetcher: DeliveryFetcher = apiFetch,
): Promise<DeliveryRecord> {
  return fetcher<DeliveryRecord>(`/deliveries/runs/${runServerId}/end`, {
    method: "POST",
    body,
    token,
  });
}
