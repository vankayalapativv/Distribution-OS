import type { MapMarker, MapRoute } from "vardhan-maps/react";
import type { RoutePoint, TrackedExecutive } from "./tracking-api";
import { isFresh } from "./tracking-helpers";

// Safety net: reveal the map after this long even if the render-complete signal
// never fires (e.g. tiles fail), so the loader can't get stuck.
export const READY_FALLBACK_MS = 10_000;

// The customer base spans these states — draw their district borders for context.
export const CUSTOMER_STATES = ["Telangana"];
// State bold, district faint (per the map design).
export const STATE_OUTLINE = { color: "#475569", weight: 2, fillOpacity: 0 };
export const CUSTOMER_DISTRICT = { color: "#94a3b8", weight: 0.8, opacity: 0.6, fill: false };
export const HIDDEN_DISTRICT = { stroke: false, fill: false };

const KOLKATA_TIME = new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });

// GPS trail styling: a receding slate-grey line, and each ping as a crisp white
// "bead" ringed in slate (not a solid dot) — so it never competes with the
// dues-bucket customer dots (esp. the red 61+ dots) or the visit flags.
const ROUTE_LINE_COLOR = "#94a3b8"; // slate-400 — the trail recedes
const ROUTE_BEAD_RING = "#475569"; // slate-600 — crisp ring around each ping

/** Executive positions: green fresh / grey stale, always-on name chip. */
export function execMarkers(executives: TrackedExecutive[]): MapMarker[] {
  return executives
    .filter((e) => e.lastLatitude != null && e.lastLongitude != null)
    .map((e) => ({
      lat: e.lastLatitude as number,
      lng: e.lastLongitude as number,
      label: e.name,
      permanent: true, // always-on name chip
      color: isFresh(e) ? "#16a34a" : "#9ca3af",
      radius: 7,
    }));
}

/** The selected executive's slate trail once loaded; else an invisible fly-target
 *  at their last-known spot so the camera moves instantly; else nothing. */
export function buildRoutes(routePoints: RoutePoint[], routeReady: boolean, selectedExec?: TrackedExecutive): MapRoute[] {
  if (routeReady) {
    return [{
      points: routePoints.map((p) => ({ lat: p.latitude, lng: p.longitude, label: KOLKATA_TIME.format(new Date(p.recordedAt)) })),
      color: ROUTE_LINE_COLOR, weight: 3, opacity: 0.9, showPoints: true,
      // Each GPS ping = a white bead with a slate ring (white fill + slate border).
      pointFillColor: "#ffffff", pointBorderColor: ROUTE_BEAD_RING, pointBorderWeight: 1.5, pointRadius: 3.5,
    }];
  }
  if (selectedExec) {
    const pt = { lat: selectedExec.lastLatitude as number, lng: selectedExec.lastLongitude as number };
    return [{ points: [pt, pt], color: "transparent", weight: 0 }]; // invisible fly target
  }
  return [];
}

/** Fly-to-fit key: the loaded trail's first ping (stable across polls) once ready,
 *  else the selection id (fly to last-known spot the instant an exec is picked). */
export function fitKeyOf(routeReady: boolean, routePoints: RoutePoint[], selectedUserId?: string | null): string {
  return routeReady ? `r:${routePoints[0]?.recordedAt}` : `s:${selectedUserId ?? "none"}`;
}

/** The executive a clicked position marker belongs to (customer dots + visit flags
 *  return undefined — flags carry an `icon`, dots don't match a position). */
export function execForMarker(executives: TrackedExecutive[], m: MapMarker): TrackedExecutive | undefined {
  if (m.icon) return undefined; // visit flag → its own popup handles the click
  return executives.find((e) => e.lastLatitude === m.lat && e.lastLongitude === m.lng);
}
