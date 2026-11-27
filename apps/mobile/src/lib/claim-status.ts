import type { ClaimStatus } from "./expense-claims";

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
