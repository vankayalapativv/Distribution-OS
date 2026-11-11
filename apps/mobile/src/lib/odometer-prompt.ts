/**
 * Mandatory whole-km odometer prompt, shared by the Start-day and End-day flows.
 * Re-asks until a valid non-negative integer (≥ min, when given) is entered, or
 * returns null if the SE cancelled.
 */
import type { ConfirmOptions, PromptOptions } from "../components/dialog-types";

type Confirm = (opts: ConfirmOptions) => Promise<boolean>;
type Prompt = (opts: PromptOptions) => Promise<string | null>;

/** A day's travel (end − start) must sit in this km band. Below the minimum is
 *  the "0 → 1" gaming; above the maximum is a typo like "1 → 1300". Mirrored by
 *  the server guard in apps/api tracking-sessions (the source of truth). */
export const MIN_DAY_DISTANCE_KM = 10;
export const MAX_DAY_DISTANCE_KM = 200;

type OdometerBounds = {
  greaterThan?: number | null;
  minDistanceKm?: number;
  maxDistanceKm?: number;
};
type Notice = { title: string; message: string };

/** Validate a parsed odometer value; returns the notice to show, or null if OK. */
function odometerError(value: number, opts: OdometerBounds): Notice | null {
  if (!Number.isInteger(value) || value < 0 || value >= 10_000_000) {
    return {
      title: "Enter a valid reading",
      message: "The odometer reading must be a whole number of kilometres.",
    };
  }
  if (opts.greaterThan == null) return null;

  const start = opts.greaterThan;
  const distance = value - start;
  if (distance <= 0) {
    return {
      title: "Reading too low",
      message: `The end reading must be higher than the start reading (${start.toLocaleString("en-IN")} km).`,
    };
  }
  if (opts.minDistanceKm != null && distance < opts.minDistanceKm) {
    return {
      title: "Reading looks too low",
      message: `A day's travel must be at least ${opts.minDistanceKm} km. Your start was ${start.toLocaleString("en-IN")} km — enter your real current reading.`,
    };
  }
  if (opts.maxDistanceKm != null && distance > opts.maxDistanceKm) {
    return {
      title: "Reading looks too high",
      message: `That's ${distance.toLocaleString("en-IN")} km in a day (over the ${opts.maxDistanceKm} km limit). Please check the reading.`,
    };
  }
  return null;
}

export async function promptOdometer(
  dialog: { prompt: Prompt; confirm: Confirm },
  /**
   * `greaterThan`: the reading must be strictly higher than this (the day's start).
   * When it is set, the End reading is also held to a plausible day distance —
   * `minDistanceKm` ≤ (value − start) ≤ `maxDistanceKm`.
   */
  opts: {
    title: string;
    message: string;
    greaterThan?: number | null;
    minDistanceKm?: number;
    maxDistanceKm?: number;
    /** Style the prompt's Continue + the validation notices as destructive (red).
     *  Used by End day — it stops tracking and can't be re-started today. */
    destructive?: boolean;
  },
): Promise<number | null> {
  // Validation notices read as errors (red) when the flow is destructive.
  const notify = (title: string, message: string) =>
    dialog.confirm({ title, message, confirmLabel: "OK", cancelLabel: null, destructive: opts.destructive });

  for (;;) {
    const raw = await dialog.prompt({
      title: opts.title,
      message: opts.message,
      placeholder: "e.g. 45200",
      confirmLabel: "Continue",
      required: true,
      keyboardType: "number-pad",
      destructive: opts.destructive,
    });
    if (raw == null) return null; // cancelled

    const value = Number(raw.trim());
    const error = odometerError(value, opts);
    if (error) {
      await notify(error.title, error.message);
      continue;
    }
    return value;
  }
}
