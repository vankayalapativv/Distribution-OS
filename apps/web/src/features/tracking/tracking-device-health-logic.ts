import type { DeviceHealth } from "./tracking-api";

export type Sev = "ok" | "warn" | "crit";

export const DOT: Record<Sev, string> = { ok: "bg-green-500", warn: "bg-amber-500", crit: "bg-red-500" };

/** Minutes since an ISO timestamp, or null. */
function minsSince(iso: string | null): number | null {
  if (!iso) return null;
  return (Date.now() - new Date(iso).getTime()) / 60000;
}

/** Coverage today = actual pings vs expected at one per 3 min over the session. */
export function coverage(d: DeviceHealth): number | null {
  if (!d.startedAt) return null;
  const start = new Date(d.startedAt).getTime();
  const end = d.endedAt ? new Date(d.endedAt).getTime() : Date.now();
  const mins = Math.max(0, (end - start) / 60000);
  const expected = Math.max(1, mins / 3);
  return Math.min(100, Math.round((100 * d.todayPoints) / expected));
}

/** "just now" / "N min ago" / "Nh Nm ago", or "—". */
export function ago(iso: string | null): string {
  const m = minsSince(iso);
  if (m == null) return "—";
  if (m < 1) return "just now";
  if (m < 60) return `${Math.round(m)} min ago`;
  return `${Math.floor(m / 60)}h ${Math.round(m % 60)}m ago`;
}

/** Roll the raw signals into one row severity + the reasons behind it. */
export function assess(d: DeviceHealth): { sev: Sev; reasons: string[] } {
  const reasons: string[] = [];
  let sev: Sev = "ok";
  const bump = (s: Sev) => { if (s === "crit" || (s === "warn" && sev === "ok")) sev = s; };
  const active = d.sessionStatus === "active";
  const stale = minsSince(d.lastRecordedAt);
  const cov = coverage(d);

  if (d.backgroundPermission && d.backgroundPermission !== "granted") { reasons.push("Background location not granted"); bump("crit"); }
  if (d.isLocationEnabled === false) { reasons.push("Location services off"); bump("crit"); }
  if (active && stale != null && stale > 15) { reasons.push(`No ping for ${Math.round(stale)} min`); bump("crit"); }
  if (d.batteryOptimizationStatus && d.batteryOptimizationStatus !== "unrestricted") { reasons.push("Battery optimization not disabled"); bump("warn"); }
  if (d.lowPowerMode) { reasons.push("Low-power mode on"); bump("warn"); }
  if (cov != null && cov < 70) { reasons.push(`Only ${cov}% of expected pings`); bump("warn"); }
  if (d.todayPoints === 0) { reasons.push("No pings today"); bump(active ? "crit" : "warn"); }
  return { sev, reasons };
}

export interface DeviceRow { d: DeviceHealth; sev: Sev; reasons: string[]; }

/** Assess every device and sort worst-first, then by name. */
export function sortDeviceRows(devices: DeviceHealth[]): DeviceRow[] {
  const order: Record<Sev, number> = { crit: 0, warn: 1, ok: 2 };
  return devices
    .map((d) => ({ d, ...assess(d) }))
    .sort((a, b) => order[a.sev] - order[b.sev] || a.d.name.localeCompare(b.d.name));
}
