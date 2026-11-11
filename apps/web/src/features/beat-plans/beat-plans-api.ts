/**
 * Types for the Beat Plans config page (GET /beat-plans, PUT/DELETE assign).
 * A customer sits on one weekday (1=Mon … 6=Sat) of an SE's recurring beat,
 * or `weekday: null` = unassigned.
 */

export interface BeatCustomer {
  customerId: string;
  customerCode: string;
  legalName: string;
  tradeName: string | null;
  phone: string | null;
  city: string | null;
  /** Comma-joined segments ("2W,Car") for the coloured segment icons. */
  segment: string | null;
  weekday: number | null;
  sequenceNo: number;
}

/** Client-side "contains" search across the fields a user might type into the
 *  Add dialog: legal name, customer (trade) name, phone, city, and code. */
export function matchesQuery(c: BeatCustomer, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [c.legalName, c.tradeName, c.phone, c.city, c.customerCode].some((f) =>
    (f ?? "").toLowerCase().includes(needle),
  );
}

export interface BeatExecutive {
  id: string;
  name: string;
}

export interface ExecutivesResponse {
  executives: BeatExecutive[];
}

export interface BeatPlanResponse {
  customers: BeatCustomer[];
}

export interface WeekdayDef {
  value: number;
  label: string;
  full: string;
}

/** Monday–Saturday, 1-indexed to match the API's weekday numbers. */
export const WEEKDAYS: readonly WeekdayDef[] = [
  { value: 1, label: "Mon", full: "Monday" },
  { value: 2, label: "Tue", full: "Tuesday" },
  { value: 3, label: "Wed", full: "Wednesday" },
  { value: 4, label: "Thu", full: "Thursday" },
  { value: 5, label: "Fri", full: "Friday" },
  { value: 6, label: "Sat", full: "Saturday" },
] as const;
