/** "7h 35m" / "45m" between two instants; null when start is unusable. `endIso`
 *  null means the run is still active → measure elapsed time up to `nowMs`. */
export function runDuration(startIso: string, endIso: string | null, nowMs: number = Date.now()): string | null {
  const start = Date.parse(startIso);
  if (Number.isNaN(start)) return null;
  const end = endIso ? Date.parse(endIso) : nowMs;
  if (Number.isNaN(end) || end < start) return null;
  const mins = Math.round((end - start) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/** true when a run has no end time yet (driver still on the road). */
export function isActiveRun(status: string, endedAt: string | null): boolean {
  return status === "active" || !endedAt;
}

/** "142 km" or an em-dash when the distance is unknown (odometer not captured). */
export function distanceLabel(km: number | null): string {
  return km != null ? `${km} km` : "—";
}
