// Real IO adapters for the delivery run actions (delivery-run-actions.ts). This
// is the ONLY place the run orchestration touches native modules, so the action
// logic itself stays node-testable. The screen builds an io with these; tests
// pass fakes instead.

import { getLocalDb } from "./db";
import { sendEndRun, sendStartRun } from "./delivery-remote";
import type { EndRunIo, StartRunIo } from "./delivery-run-actions";
import { deleteProofPhoto, uploadDeliveryPhoto } from "./photos";
import { kickSync } from "./sync";
import {
  mirrorEndedDeliveryRun,
  mirrorStartedDeliveryRun,
  recordDeliveryEnd,
  recordDeliveryStart,
} from "./sync-core";

export function startRunIo(token: string | null): StartRunIo {
  return {
    token,
    db: getLocalDb(),
    send: sendStartRun,
    mirror: mirrorStartedDeliveryRun,
    upload: (runId, path, t) => uploadDeliveryPhoto(runId, path, "start_odometer", null, t),
    del: deleteProofPhoto,
    queue: (db, input, now) => {
      recordDeliveryStart(db, input, now);
      void kickSync();
    },
  };
}

export function endRunIo(token: string | null): EndRunIo {
  return {
    token,
    db: getLocalDb(),
    send: sendEndRun,
    upload: (runId, path, t) => uploadDeliveryPhoto(runId, path, "end_odometer", null, t),
    del: deleteProofPhoto,
    mirror: mirrorEndedDeliveryRun,
    queue: (db, input, now) => {
      recordDeliveryEnd(db, input, now);
      void kickSync();
    },
  };
}
