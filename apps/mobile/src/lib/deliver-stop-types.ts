// Types + input mapping for the delivery-stop save. Split out of
// deliver-stop-actions.ts to keep that orchestration file small.
import type { LocalDb } from "./local-db";
import type { DeliveryStopInput } from "./sync-core";

export interface StopInput {
  clientUuid: string;
  runClientUuid: string;
  runServerId: string | null;
  customerId: string;
  customerName: string | null;
  invoiceId: string;
  invoiceNumber: string;
  photoPaths: string[];
  latitude: number | null;
  longitude: number | null;
}

export interface StopIo {
  token: string | null;
  db: LocalDb | null;
  sendStop: (runServerId: string, body: Record<string, unknown>, token: string | null) => Promise<{ id: string }>;
  uploadPhoto: (runServerId: string, path: string, stopId: string, token: string | null, geo: { latitude: number | null; longitude: number | null }) => Promise<void>;
  del: (path: string) => void;
  mirror: (db: LocalDb, input: DeliveryStopInput & { serverId: string }, now: number) => void;
  /** Offline fallback: record the stop locally + enqueue it. */
  queue: (db: LocalDb, input: DeliveryStopInput, now: number) => void;
}

export type StopResult = { id: string; queued?: boolean };

export const toRecord = (i: StopInput): DeliveryStopInput => ({
  clientUuid: i.clientUuid,
  runClientUuid: i.runClientUuid,
  customerId: i.customerId,
  customerName: i.customerName,
  latitude: i.latitude,
  longitude: i.longitude,
  invoiceId: i.invoiceId,
  invoiceNumber: i.invoiceNumber,
  photoPaths: i.photoPaths,
});
