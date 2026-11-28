import type { ClaimStatus } from "./expense-claims";

/** A claim's submission moment for the row, e.g. "28 Nov 2026, 9:45 am" (IST).
 *  Falls back to the raw value if it isn't a parseable timestamp. */
export function claimMoment(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
  return `${date}, ${time.toLowerCase()}`;
}

/** Label + Tailwind tone classes for a claim's status chip. */
export function claimStatusMeta(status: ClaimStatus): { label: string; chip: string } {
  switch (status) {
    case "approved":
      return { label: "Approved", chip: "bg-emerald-50 text-emerald-700" };
    case "rejected":
      return { label: "Rejected", chip: "bg-red-50 text-red-600" };
    default:
      return { label: "Submitted", chip: "bg-amber-50 text-amber-700" };
  }
}
