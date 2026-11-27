/** Pure date/time helpers for the in-app reminder picker (no native OS picker). */

export function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function to12h(h24: number): { h: number; ampm: "AM" | "PM" } {
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return { h, ampm };
}

export function to24h(h12: number, ampm: "AM" | "PM"): number {
  if (ampm === "AM") return h12 === 12 ? 0 : h12;
  return h12 === 12 ? 12 : h12 + 12;
}

/** The chosen moment, assembled from the day + 12h time parts. */
export function assemble(ymd: string, h12: number, minute: number, ampm: "AM" | "PM"): Date {
  const base = parseYmd(ymd);
  base.setHours(to24h(h12, ampm), minute, 0, 0);
  return base;
}

/** ~2 years ahead, so no day in the picker is ever disabled. */
export const FAR_FUTURE = toYmd(new Date(Date.now() + 730 * 86400000));
