// Online-first orchestration for the run-level delivery writes (start-run and
// end-run), extracted so it integration-tests without React/native modules. All
// IO is injected — the screen supplies real adapters (delivery-run-io.ts), tests
// supply fakes.
//
// The server is the source of truth: each write goes to the API first and, on
// success, is mirrored into the local DB (immediate display) with the odometer
// photo uploaded best-effort. When the network genuinely fails, the write is
// parked in the durable offline queue (via the injected `queue` adapter) and
// syncs on reconnect — idempotent by clientUuid, so no duplicates.

import type { LocalDb } from "./local-db";
import { submitWrite } from "./online-first";

export interface StartRunInput {
  clientUuid: string;
  vehicleNumber: string;
  startOdometer: number;
  runDate: string;
  startPhotoPath: string;
}
export interface StartRunIo {
  token: string | null;
  db: LocalDb | null;
  send: (body: { vehicleNumber: string; startOdometer: number; clientUuid: string }, token: string | null) => Promise<{ id: string }>;
  mirror: (db: LocalDb, input: StartRunInput & { serverId: string }, now: number) => void;
  upload: (runId: string, path: string, token: string | null) => Promise<void>;
  del: (path: string) => void;
  /** Offline fallback: record the run locally + enqueue the start. */
  queue: (db: LocalDb, input: StartRunInput, now: number) => void;
}

export type RunResult = { id: string; queued?: boolean };

export async function performStartRun(input: StartRunInput, io: StartRunIo): Promise<RunResult> {
  const { vehicleNumber, startOdometer, clientUuid } = input;
  const outcome = await submitWrite<{ id: string }>({
    send: async () => {
      const run = await io.send({ vehicleNumber, startOdometer, clientUuid }, io.token);
      if (io.db) {
        try {
          io.mirror(io.db, { ...input, serverId: run.id }, Date.now());
        } catch {
          // read-only DB: the run exists on the server; a server-first refresh covers display.
        }
      }
      try {
        await io.upload(run.id, input.startPhotoPath, io.token);
        io.del(input.startPhotoPath);
      } catch {
        // odometer photo is proof, not the record — keep the file for a retry.
      }
      return run;
    },
    queue: () => {
      if (!io.db) throw new Error("no local db");
      io.queue(io.db, input, Date.now());
    },
  });
  if (outcome.status === "sent") return outcome.data;
  if (outcome.status === "queued") return { id: "", queued: true };
  throw new Error(
    outcome.status === "unsaved"
      ? "Couldn't save the run on this device — try again."
      : "The server rejected the run — check the details and try again.",
  );
}

export interface EndRunInput {
  runClientUuid: string;
  endOdometer: number;
  endPhotoPath: string;
  runServerId: string | null;
}
export interface EndRunIo {
  token: string | null;
  db: LocalDb | null;
  send: (runServerId: string, body: { runClientUuid: string; endOdometer: number }, token: string | null) => Promise<{ id: string }>;
  upload: (runId: string, path: string, token: string | null) => Promise<void>;
  del: (path: string) => void;
  mirror: (db: LocalDb, input: { runClientUuid: string; endOdometer: number }, now: number) => void;
  /** Offline fallback: close the run locally + enqueue the end. */
  queue: (db: LocalDb, input: { runClientUuid: string; endOdometer: number; endPhotoPath: string }, now: number) => void;
}

export async function performEndRun(input: EndRunInput, io: EndRunIo): Promise<RunResult> {
  const endBody = { runClientUuid: input.runClientUuid, endOdometer: input.endOdometer };
  const queueEnd = () => {
    if (!io.db) throw new Error("no local db");
    io.queue(io.db, { ...endBody, endPhotoPath: input.endPhotoPath }, Date.now());
  };

  // The run was started offline and hasn't synced → no server id to target yet.
  // Queue the end; FIFO sends it once the start syncs.
  if (!input.runServerId) {
    try {
      queueEnd();
    } catch {
      throw new Error("Couldn't save the run end on this device — try again.");
    }
    return { id: "", queued: true };
  }

  const serverId = input.runServerId;
  const outcome = await submitWrite<{ id: string }>({
    send: async () => {
      const ended = await io.send(serverId, endBody, io.token);
      try {
        await io.upload(serverId, input.endPhotoPath, io.token);
        io.del(input.endPhotoPath);
      } catch {
        // odometer photo is proof, not the record — keep the file for a retry.
      }
      if (io.db) {
        try {
          io.mirror(io.db, endBody, Date.now());
        } catch {
          // read-only DB: the server already ended the run, so ignore.
        }
      }
      return ended;
    },
    queue: queueEnd,
  });
  if (outcome.status === "sent") return outcome.data;
  if (outcome.status === "queued") return { id: "", queued: true };
  throw new Error(
    outcome.status === "unsaved"
      ? "Couldn't save the run end on this device — try again."
      : "The server rejected the run end — check the odometer and try again.",
  );
}
