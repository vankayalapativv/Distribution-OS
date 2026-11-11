// Gathers native inputs (GPS fix, persisted photos, the run's server id) and
// runs the online-only stop save (performSaveDeliveryStop). Returns whether the
// caller should navigate back (saved) plus busy/error UI state; a failed server
// write surfaces as an error the driver retries.

import * as Crypto from "expo-crypto";
import { useState } from "react";
import { useAuth } from "./auth";
import type { DeliverableInvoice } from "./deliverable-invoice";
import { performSaveDeliveryStop } from "./deliver-stop-actions";
import { stopIo } from "./deliver-stop-io";
import { getLocalDb } from "./db";
import { getCheckInFix } from "./gps";
import { persistDeliveryPhoto, type PickedPhoto } from "./photos";

export function useSaveDeliveryStop(runClientUuid: string | undefined, picked: DeliverableInvoice | null, photos: PickedPhoto[]) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(): Promise<boolean> {
    if (busy || !picked || !runClientUuid) return false;
    if (photos.length === 0) {
      setError("Add at least one photo.");
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      const clientUuid = Crypto.randomUUID();
      const photoPaths = photos.map((p, i) => persistDeliveryPhoto(`${clientUuid}-${i}`, p));
      const fix = await getCheckInFix().catch(() => null);
      const db = getLocalDb();
      const runServerId =
        db?.first<{ server_id: string | null }>(
          "select server_id from delivery_runs where client_uuid = ?",
          [runClientUuid],
        )?.server_id ?? null;
      await performSaveDeliveryStop(
        {
          clientUuid,
          runClientUuid,
          runServerId,
          customerId: picked.customerId,
          customerName: picked.customerName,
          invoiceId: picked.id,
          invoiceNumber: picked.invoiceNumber,
          photoPaths,
          latitude: fix?.latitude ?? null,
          longitude: fix?.longitude ?? null,
        },
        stopIo(useAuth.getState().token),
      );
      return true;
    } catch (e) {
      // Online-required: a failed server write is kept in the form for retry.
      setError(e instanceof Error ? e.message : "Couldn't save this delivery — check your signal and tap Save again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, setError, save };
}
