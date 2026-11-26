// Online-first orchestration for the END-run delivery write. See
// delivery-run-start.ts for the shared online-first/offline-queue model.

import type { LocalDb } from "./local-db";
import { submitWrite } from "./online-first";
import type { RunResult } from "./delivery-run-start";

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
