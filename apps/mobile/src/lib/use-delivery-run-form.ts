// Submit handlers for starting/ending a delivery run. Field state lives in
// use-run-fields; the online-only write lives in delivery-run-actions. This
// hook validates, calls the action, and surfaces any failure as a retryable error.

import * as Crypto from "expo-crypto";
import { useState } from "react";
import { useDialog } from "../components/dialog";
import { useAuth } from "./auth";
import { performEndRun, performStartRun } from "./delivery-run-actions";
import { endRunIo, startRunIo } from "./delivery-run-io";
import { hasErrors, normalizeVehicle, validateEndForm, validateStartForm } from "./delivery-validation";
import { startDayTracking, stopDayTracking } from "./gps";
import { istDate } from "./day-flag";
import { runStartDayPermissionSetup } from "./permissions";
import { persistDeliveryPhoto, type PickedPhoto } from "./photos";
import type { RunFields } from "./use-run-fields";
import type { LocalDeliveryRun } from "./sync-core";
export interface RunSubmitArgs {
  active: LocalDeliveryRun | null;
  stopsCount: number;
  reload: () => void;
  fields: RunFields;
  odoPhoto: PickedPhoto | null;
  endPhoto: PickedPhoto | null;
  resetPhotos: () => void;
}

export function useDeliveryRunForm(a: RunSubmitArgs) {
  const dialog = useDialog();
  const { fields } = a;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState<{ vehicle: string; stops: number; km: number | null } | null>(null);

  async function onStart() {
    if (busy) return;
    setError(null);
    const errs = validateStartForm({ vehicle: fields.vehicle, odo: fields.odo, hasPhoto: !!a.odoPhoto });
    fields.setStartErr(errs);
    if (hasErrors(errs)) return;
    setBusy(true);
    try {
      const perms = await runStartDayPermissionSetup(dialog.confirm);
      if (!perms.ok) return;
      const clientUuid = Crypto.randomUUID();
      const startPhotoPath = persistDeliveryPhoto(`${clientUuid}-start`, a.odoPhoto!);
      await performStartRun(
        { clientUuid, vehicleNumber: normalizeVehicle(fields.vehicle), startOdometer: Number(fields.odo), runDate: istDate(), startPhotoPath },
        startRunIo(useAuth.getState().token),
      );
      await startDayTracking().catch(() => {});
      fields.setMode("idle"); fields.resetStart(); a.resetPhotos();
      a.reload();
    } catch (e) {
      // Online-required: a failed server write is kept in the form for retry.
      setError(e instanceof Error ? e.message : "Couldn't start the run — check your signal and tap Start again.");
    } finally {
      setBusy(false);
    }
  }

  async function onEnd() {
    const run = a.active;
    if (busy || !run) return;
    setError(null);
    const errs = validateEndForm({ endOdo: fields.endOdo, hasPhoto: !!a.endPhoto, startOdometer: run.startOdometer });
    fields.setEndErr(errs);
    if (hasErrors(errs)) return;
    setBusy(true);
    try {
      const endPhotoPath = persistDeliveryPhoto(`${run.clientUuid}-end`, a.endPhoto!);
      const km = run.startOdometer != null ? Number(fields.endOdo) - run.startOdometer : null;
      const endInput = { runClientUuid: run.clientUuid, endOdometer: Number(fields.endOdo), endPhotoPath, runServerId: run.serverId };
      // Online-required: the run must be ended on the server before we stop
      // tracking — a failed end leaves the run active, so tracking keeps running.
      await performEndRun(endInput, endRunIo(useAuth.getState().token));
      await stopDayTracking();
      setFinished({ vehicle: run.vehicleNumber, stops: a.stopsCount, km });
      fields.setMode("idle"); fields.resetEnd(); a.resetPhotos();
      a.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't end the run — check your signal and tap End again.");
    } finally {
      setBusy(false);
    }
  }

  async function onEndPress() {
    const ok = await dialog.confirm({ title: "End deliveries?", message: "Are you sure you want to end your deliveries for today?", confirmLabel: "Yes, end", cancelLabel: "No", destructive: true });
    if (ok) { setError(null); fields.setMode("end"); }
  }

  return { busy, error, setError, finished, setFinished, onStart, onEnd, onEndPress };
}
