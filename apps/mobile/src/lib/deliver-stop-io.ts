// Real IO adapters for performSaveDeliveryStop (deliver-stop-actions.ts). The
// only place the stop orchestration touches native modules, keeping the action
// logic node-testable.

import { getLocalDb } from "./db";
import { sendAddStop } from "./delivery-remote";
import type { StopIo } from "./deliver-stop-actions";
import { deleteProofPhoto, uploadDeliveryPhoto } from "./photos";
import { kickSync } from "./sync";
import { mirrorSentDeliveryStop, recordDeliveryStop } from "./sync-core";

export function stopIo(token: string | null): StopIo {
  return {
    token,
    db: getLocalDb(),
    sendStop: (runServerId, body, t) =>
      sendAddStop(runServerId, body as unknown as Parameters<typeof sendAddStop>[1], t),
    uploadPhoto: (runServerId, path, stopId, t, geo) =>
      uploadDeliveryPhoto(runServerId, path, "delivery", stopId, t, geo),
    del: deleteProofPhoto,
    mirror: mirrorSentDeliveryStop,
    queue: (db, input, now) => {
      recordDeliveryStop(db, input, now);
      void kickSync();
    },
  };
}
