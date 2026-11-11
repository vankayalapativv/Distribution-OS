// Online-first orchestration for saving ONE delivery stop, extracted from the
// screen so it integration-tests without React/native modules. All IO is
// injected. The stop POST goes to the server first; on success it is mirrored
// into the local cache (immediate display) with proof photos uploaded
// best-effort. When the network fails — or the run was started offline and has
// no server id yet — the stop is parked in the durable offline queue and syncs
// on reconnect (idempotent by clientUuid; FIFO sends it after the run).

import type { LocalDb } from "./local-db";
import { submitWrite } from "./online-first";
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

const toRecord = (i: StopInput): DeliveryStopInput => ({
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

export async function performSaveDeliveryStop(input: StopInput, io: StopIo): Promise<StopResult> {
  const queueStop = () => {
    if (!io.db) throw new Error("no local db");
    io.queue(io.db, toRecord(input), Date.now());
  };

  // The run was started offline and hasn't synced → no server id to target yet.
  // Queue the stop; FIFO sends it once the run syncs.
  if (!input.runServerId) {
    try {
      queueStop();
    } catch {
      throw new Error("Couldn't save the stop on this device — try again.");
    }
    return { id: "", queued: true };
  }

  const serverId = input.runServerId;
  const geo = { latitude: input.latitude, longitude: input.longitude };
  const body = {
    runClientUuid: input.runClientUuid,
    customerId: input.customerId,
    latitude: input.latitude,
    longitude: input.longitude,
    invoiceId: input.invoiceId,
    clientUuid: input.clientUuid,
  };
  const outcome = await submitWrite<{ id: string }>({
    send: async () => {
      const stop = await io.sendStop(serverId, body, io.token);
      // Photos are proof, not the delivery record — never let them fail the save.
      for (const path of input.photoPaths) {
        try {
          await io.uploadPhoto(serverId, path, stop.id, io.token, geo);
          io.del(path);
        } catch {
          // keep the file for a manual retry
        }
      }
      if (io.db) {
        try {
          io.mirror(io.db, { ...toRecord(input), serverId: stop.id }, Date.now());
        } catch {
          // read-only DB: the server already has it, so ignore.
        }
      }
      return stop;
    },
    queue: queueStop,
  });
  if (outcome.status === "sent") return outcome.data;
  if (outcome.status === "queued") return { id: "", queued: true };
  throw new Error(
    outcome.status === "unsaved"
      ? "Couldn't save the stop on this device — try again."
      : "The server rejected the stop — please try again.",
  );
}
