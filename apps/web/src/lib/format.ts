/**
 * Shared display formatters. Features previously defined their own copies of
 * these (rupees/formatDate/litres/…); import from here instead.
 *
 * Note the Neon Date quirk: `date` columns can arrive as strings OR JS Date —
 * `dateStr` handles both. See apps/web/AGENTS.md.
 */

/** ₹ with Indian digit grouping; "—" for zero. */
export function rupees(n: number): string {
  return n === 0 ? "—" : `₹${n.toLocaleString("en-IN")}`;
}

/** ₹ that always shows a value (no "—" for zero). */
export function rupeesExact(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

/** Litres: integers plain, else 1 dp; "—" for zero. */
export function litres(n: number): string {
  if (n === 0) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Plain count; "—" for zero. */
export function count(n: number): string {
  return n === 0 ? "—" : String(n);
}

/** Save-button caption: "Saving…" while busy, "Save changes" when editing, else the create label. */
export function saveLabel(busy: boolean, editing: unknown, createLabel: string): string {
  if (busy) return "Saving…";
  return editing ? "Save changes" : createLabel;
}

/** Plural suffix for a count: "" for exactly one, else "s". */
export function plural(n: number): string {
  return n === 1 ? "" : "s";
}

function toDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  // Bare `YYYY-MM-DD` → treat as local midnight, not UTC.
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00` : v;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Single-client Hyderabad deployment → always display in IST. Pinning the zone
// (rather than relying on the runtime's) keeps server-rendered output (Workers =
// UTC) correct and identical to the browser's, avoiding day/time shifts and SSR
// hydration mismatches. Matches `istYmd` / `formatLastSeen` below.
const IST_TIME_ZONE = "Asia/Kolkata";

/** `12 Jul 2026`, or "—" when empty/invalid. */
export function formatDate(v: string | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: IST_TIME_ZONE });
}

/** `12 Jul` (no year). */
export function formatDayMonth(v: string | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: IST_TIME_ZONE });
}

/** `01:05 am` IST-style time, or "—". */
export function formatTime(v: string | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return "—";
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: IST_TIME_ZONE });
}

/** `12 Jul 2026 · 01:05 am` (date + time), or "—" when empty/invalid. */
export function formatDateTime(v: string | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return "—";
  return `${formatDate(d)} · ${formatTime(d)}`;
}

// YYYY-MM-DD for a date in IST (so "day" boundaries are the business day, not
// the viewer's timezone). Fixed locale/timezone keeps SSR + client identical.
function istYmd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Human "last seen" relative to today (IST):
 *  - today → just the time (`3:58 pm`)
 *  - yesterday → `yesterday 3:58 pm`
 *  - older → `1 Aug, 3:58 pm` (adds the year only if it's a past year)
 * Always rendered in IST so a bare time from days ago can't read as "today".
 */
export function formatLastSeen(v: string | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return "—";
  const nowYmd = istYmd(new Date());
  const valYmd = istYmd(d);
  const diffDays = Math.round(
    (Date.parse(`${nowYmd}T00:00:00Z`) - Date.parse(`${valYmd}T00:00:00Z`)) / 86_400_000,
  );
  const time = new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(d);
  if (diffDays <= 0) return time; // today (or a clock-skewed future ping)
  if (diffDays === 1) return `yesterday ${time}`;
  const sameYear = nowYmd.slice(0, 4) === valYmd.slice(0, 4);
  const date = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "Asia/Kolkata",
  }).format(d);
  return `${date}, ${time}`;
}
