// IST-aware formatting for the attendance views.

/** Today as YYYY-MM-DD in IST (default for the daily picker). */
export function todayYmd(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

/** Current month as YYYY-MM in IST (default for the monthly picker). */
export function thisMonth(): string {
  return todayYmd().slice(0, 7);
}

/** ISO timestamp → IST clock time, e.g. "10:51 am". Empty for null. */
export function istTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso)
    .toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase();
}

/** Whole-km odometer reading → "45,200 km". Em dash for null. */
export function km(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v.toLocaleString("en-IN")} km`;
}

/** Distance travelled = end − start, when both readings exist and end ≥ start. */
export function distanceKm(start: number | null, end: number | null): number | null {
  if (start == null || end == null) return null;
  const d = end - start;
  return d >= 0 ? d : null;
}

/** YYYY-MM-DD → "Mon, 28 Jul" (IST). */
export function dayLabel(ymd: string): string {
  return new Date(`${ymd}T00:00:00+05:30`).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Hours as a short label, e.g. "8.5h". Em dash for null. */
export function hoursLabel(h: number | null | undefined): string {
  if (h == null) return "—";
  return `${h.toFixed(1)}h`;
}

/** Initials for an avatar chip, e.g. "Vishnu Vardhan" → "VV", "BHASKAR" → "BH". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "–";
  const first = parts[0][0] ?? "";
  const second = parts[1]?.[0] ?? parts[0][1] ?? "";
  return (first + second).toUpperCase();
}

/** Minutes-since-midnight (IST) for an ISO timestamp, or null. Used to place timeline bars. */
export function istMinutes(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const h = Number(parts.find((p) => p.type === "hour")?.value);
  const m = Number(parts.find((p) => p.type === "minute")?.value);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return (h % 24) * 60 + m;
}

/** Present-days count: whole numbers plain, half-days with one decimal (24, 24.5). */
export function fmtDays(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
