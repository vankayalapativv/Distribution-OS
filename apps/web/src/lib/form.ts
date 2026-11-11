/** Shared FormData extraction helpers (were duplicated across create dialogs). */

/** Trimmed string field, or null when empty. */
export function nullableFormValue(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value : null;
}

/** Numeric field, or null when empty / not a finite number. */
export function nullableNumberValue(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Required trimmed string field. */
export function stringFormValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/** Normalise a 10-digit Indian mobile into `+91XXXXXXXXXX`, or null when empty. */
export function indianPhone(formData: FormData, key: string): string | null {
  const digits = String(formData.get(key) ?? "").replace(/\D/g, "");
  return digits ? `+91${digits}` : null;
}
