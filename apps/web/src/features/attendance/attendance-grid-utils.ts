// Pure month/weekday helpers for the attendance grid (kept separate so they can be
// unit-tested without rendering the table).

/** Shift a YYYY-MM month by ±1 (calendar-correct across year boundaries). */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Shift a YYYY-MM-DD date by ±N days (calendar-correct; UTC math avoids DST drift). */
export function shiftDay(ymd: string, by: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + by));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/** Every day of a YYYY-MM month as YYYY-MM-DD — the grid's columns, known before data loads. */
export function monthDays(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

/** YYYY-MM → "July 2026". */
export function monthTitle(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Weekday initial for a YYYY-MM-DD (IST), e.g. "S" for Sunday. */
export function weekdayInfo(ymd: string): { initial: string; sunday: boolean } {
  const d = new Date(`${ymd}T00:00:00+05:30`);
  const wd = d.toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" });
  return { initial: wd[0], sunday: wd.startsWith("Sun") };
}
