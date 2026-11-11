/** Severity → pill classes, and alert-type code → human label. */

export const SEVERITY_CLASSES: Record<string, string> = {
  high: "bg-red-50 text-red-700 ring-1 ring-red-600/20",
  medium: "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-600/20",
  low: "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20",
  info: "bg-slate-100 text-slate-600",
};

export const ALERT_TYPE_LABELS: Record<string, string> = {
  COLLECTION_REJECTED: "Collection Rejected",
  CREDIT_OVERDUE: "Credit Overdue",
  PAYMENT_BOUNCED: "Payment Bounced",
  ORDER_PENDING: "Order Pending",
};
