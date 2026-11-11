// Shared coercion + filter helpers for the logistics read views. Neon returns
// PostgreSQL `date`/`timestamptz` as JS Date and numerics as strings, so every
// value is normalised here before it leaves the service layer.

export type Row = Record<string, unknown>;

export function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return v == null ? "" : String(v);
}
export function strOrNull(v: unknown): string | null {
  const s = str(v);
  return s.length > 0 ? s : null;
}
/** YYYY-MM-DD (a `date` column, no time). */
export function dateStr(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string") return v.slice(0, 10);
  return "";
}
export function num(v: unknown): number {
  return Number(v ?? 0);
}
export function numOrNull(v: unknown): number | null {
  return v == null ? null : Number(v);
}

/** `%q%` for ILIKE, or null when the query is blank. */
export function likeOf(q?: string | null): string | null {
  const t = (q ?? "").trim();
  return t.length > 0 ? `%${t}%` : null;
}
/** A safe YYYY-MM-DD date filter, or null when absent/malformed. */
export function dateOf(d?: string | null): string | null {
  const t = (d ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
}

export interface ListParams {
  q?: string | null;
  from?: string | null;
  to?: string | null;
  sort?: string | null;
  dir?: string | null;
  page?: number | null;
  pageSize?: number | null;
}

export interface Paged<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}
