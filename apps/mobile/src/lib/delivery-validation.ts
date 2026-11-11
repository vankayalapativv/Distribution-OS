// Pure form validation for the delivery run start/end forms. Kept free of React
// and native modules so it's unit-testable and reusable by the screen hooks.

// Indian plate: 2 state letters, 1–2 RTO digits, 1–3 series letters, 4 digits.
const VEHICLE_RE = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;

export const normalizeVehicle = (v: string) => v.trim().toUpperCase().replace(/\s+/g, "");

export interface StartErrors {
  vehicle?: string;
  odo?: string;
  photo?: string;
}

export function validateStartForm(i: { vehicle: string; odo: string; hasPhoto: boolean }): StartErrors {
  const e: StartErrors = {};
  const v = normalizeVehicle(i.vehicle);
  if (!v) e.vehicle = "Vehicle number is required.";
  else if (!VEHICLE_RE.test(v)) e.vehicle = "Enter a valid vehicle number (e.g. TS09AB1234).";
  const n = Number(i.odo);
  if (!i.odo.trim()) e.odo = "Meter reading is required.";
  else if (!Number.isFinite(n) || n <= 0) e.odo = "Enter a valid meter reading in KM.";
  if (!i.hasPhoto) e.photo = "Add a photo of the meter.";
  return e;
}

export interface EndErrors {
  odo?: string;
  photo?: string;
}

export function validateEndForm(i: {
  endOdo: string;
  hasPhoto: boolean;
  startOdometer: number | null;
}): EndErrors {
  const e: EndErrors = {};
  const n = Number(i.endOdo);
  if (!i.endOdo.trim()) e.odo = "Meter reading is required.";
  else if (!Number.isFinite(n) || n <= 0) e.odo = "Enter a valid meter reading in KM.";
  else if (i.startOdometer != null && n < i.startOdometer)
    e.odo = `End must be same or more than the start (${i.startOdometer} KM).`;
  if (!i.hasPhoto) e.photo = "Add a photo of the meter.";
  return e;
}

export const hasErrors = (e: StartErrors | EndErrors) => Object.keys(e).length > 0;
