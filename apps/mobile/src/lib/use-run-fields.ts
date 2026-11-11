// Text-field state + change handlers for the delivery run forms. Each change
// clears its own field error for immediate feedback. Kept apart from the submit
// hook so both files stay small and single-purpose.

import { useState } from "react";
import { type EndErrors, type StartErrors } from "./delivery-validation";

export function useRunFields() {
  const [mode, setMode] = useState<"idle" | "start" | "end">("idle");
  const [vehicle, setVehicle] = useState("");
  const [odo, setOdo] = useState("");
  const [endOdo, setEndOdo] = useState("");
  const [startErr, setStartErr] = useState<StartErrors>({});
  const [endErr, setEndErr] = useState<EndErrors>({});

  const changeVehicle = (t: string) => {
    setVehicle(t.toUpperCase().replace(/[^A-Z0-9]/g, ""));
    setStartErr((s) => ({ ...s, vehicle: undefined }));
  };
  const changeOdo = (t: string) => {
    setOdo(t);
    setStartErr((s) => ({ ...s, odo: undefined }));
  };
  const changeEndOdo = (t: string) => {
    setEndOdo(t);
    setEndErr((s) => ({ ...s, odo: undefined }));
  };
  const clearStartPhotoErr = () => setStartErr((s) => ({ ...s, photo: undefined }));
  const clearEndPhotoErr = () => setEndErr((s) => ({ ...s, photo: undefined }));
  const resetStart = () => {
    setVehicle("");
    setOdo("");
    setStartErr({});
  };
  const resetEnd = () => {
    setEndOdo("");
    setEndErr({});
  };

  return {
    mode, setMode, vehicle, odo, endOdo, startErr, setStartErr, endErr, setEndErr,
    changeVehicle, changeOdo, changeEndOdo, clearStartPhotoErr, clearEndPhotoErr, resetStart, resetEnd,
  };
}

export type RunFields = ReturnType<typeof useRunFields>;
