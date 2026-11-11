/**
 * Order-date rules (business timezone = IST). Office/web users may back-date an
 * order to today or any past day, but never to a day later than today. The mobile
 * field-salesperson (SALES_EXECUTIVE) flow is exempt and does not call this.
 */

const IST = "Asia/Kolkata";

/** Today's date in IST as YYYY-MM-DD. */
export function istToday(now: Date = new Date()): string {
  // en-CA formats as ISO YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST }).format(now);
}

/**
 * Whether `orderDate` is later than today in IST. A null/empty date is never
 * "future" (the service defaults it to today). A malformed value returns false
 * so the service's own parsing surfaces the error rather than this guard.
 */
export function isFutureOrderDate(orderDate: string | null | undefined, now: Date = new Date()): boolean {
  if (!orderDate) return false;
  const d = orderDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  return d > istToday(now);
}
