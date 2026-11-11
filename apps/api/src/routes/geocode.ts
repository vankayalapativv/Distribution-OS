import { Hono } from "hono";
import { z } from "zod";
import { success } from "../lib/api-response";
import { requireRole } from "../lib/authz";
import { readJsonObject } from "../lib/request-body";
import { validate } from "../lib/validate";
import { reverseGeocode } from "../lib/geocode";
import type { ApiEnv } from "../types";

// Boundary schema (audit G-0602): lat/lng must be finite numbers in range.
const ReverseGeocodeSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

/**
 * Reverse-geocode a GPS fix to a street address for photo stamping. The Google
 * key stays in Workers secrets (never in the APK): device → this proxy → Google.
 *
 * Always returns 200 with `{ address: string | null }` — a null address (no key,
 * timeout, or Google error) means the caller stamps coordinates only. Reverse
 * geocoding must never block a field rep's photo, so this endpoint never errors
 * on a geocode failure; only bad input / auth are rejected.
 */
export const geocodeRoutes = new Hono<ApiEnv>().post("/reverse", async (c) => {
  // Office roles are harmless; the real callers are the mobile field apps.
  requireRole(c, ["SALES_EXECUTIVE", "LOGISTICS", "SUPER_ADMIN", "MANAGER", "ACCOUNTANT"]);

  const { lat, lng } = validate(ReverseGeocodeSchema, await readJsonObject(c));

  const address = await reverseGeocode(c.env.GOOGLE_GEOCODING_API_KEY, lat, lng);
  return c.json(success(c, { address }));
});
