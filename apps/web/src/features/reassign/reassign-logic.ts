import type { MovedCounts } from "./reassign-api";

/** The 7 record types that move, with a dot colour for the "what moves" grid. */
export const COUNT_LABELS: { key: keyof MovedCounts; label: string; dot: string }[] = [
  { key: "orders", label: "Orders", dot: "bg-blue-600" },
  { key: "collections", label: "Collections", dot: "bg-emerald-600" },
  { key: "invoices", label: "Invoices", dot: "bg-violet-600" },
  { key: "visits", label: "Visits", dot: "bg-cyan-600" },
  { key: "photos", label: "Photos", dot: "bg-orange-600" },
  { key: "notes", label: "Notes", dot: "bg-pink-600" },
  { key: "beatDays", label: "Beat days", dot: "bg-indigo-600" },
];

export function totalCount(c: MovedCounts): number {
  return COUNT_LABELS.reduce((sum, { key }) => sum + c[key], 0);
}

/** Up to two uppercase initials from a name. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

const AVATAR_COLORS = [
  "bg-blue-600",
  "bg-violet-600",
  "bg-pink-600",
  "bg-cyan-600",
  "bg-orange-600",
  "bg-emerald-600",
];

/** Deterministic avatar colour from a stable id, so a person keeps one colour. */
export function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}
