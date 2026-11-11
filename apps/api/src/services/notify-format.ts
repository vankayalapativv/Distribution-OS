/**
 * Context-aware notification body builders (pure). Every field/SE action alerts
 * the office naming WHICH executive did WHAT ("Sandeep · Ravi Motors"), leading
 * with the executive's first name. When the executive is unknown (e.g. an
 * office-created item), each falls back to the older customer-only wording.
 *
 * Shared by the office Web Push and the Super-Admin FCM/Alerts feed so both
 * channels read identically. Pure string logic — unit-tested, no I/O.
 */

/** Check-in: "Sandeep · Ravi Motors". */
export function checkinBody(executive: string | null, customer: string | null): string {
  if (executive) return customer ? `${executive} · ${customer}` : `${executive} checked in a customer`;
  return customer ? `${customer} checked in` : "A customer was checked in";
}

/** New order: "Sandeep · ORD-123 · Ravi Motors". */
export function orderBody(executive: string | null, orderCode: string, customer: string | null): string {
  const withCustomer = customer ? ` · ${customer}` : "";
  if (executive) return `${executive} · ${orderCode}${withCustomer}`;
  return customer ? `${orderCode} · ${customer}` : `New order ${orderCode}`;
}

/** New collection: "Sandeep · ₹5,000 from Ravi Motors" (`amount` already formatted). */
export function collectionBody(executive: string | null, amount: string, customer: string | null): string {
  if (executive) return customer ? `${executive} · ${amount} from ${customer}` : `${executive} · ${amount} collected`;
  return customer ? `${amount} from ${customer}` : `${amount} collected`;
}
