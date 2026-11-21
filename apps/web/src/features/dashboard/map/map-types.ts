/** Domain types for the Dashboard OpenStreetMap section. */

/** A customer's dues bucket is the enterprise band's key (its ordinal as a
 *  string, "0".."3"), or null when they have no outstanding. */
export type DuesBucketKey = string;

export interface MapCustomer {
  id: string;
  name: string;
  code: string;
  city: string | null;
  lat: number;
  lng: number;
  executiveId: string | null;
  executiveName: string | null;
  outstanding: number;
  ageDays: number | null;
  bucket: DuesBucketKey | null;
  /** Days since the most recent non-cancelled order (any salesperson), or null. */
  lastOrderDays: number | null;
  /** Days since the most recent non-rejected collection (any salesperson), or null. */
  lastCollectionDays: number | null;
  /** Placed ≥1 order OR made ≥1 collection in the last 30 days. */
  active: boolean;
}

export interface MapPosition {
  userId: string;
  name: string;
  lat: number;
  lng: number;
  recordedAt: string | null;
  live: boolean;
}
export interface MapCheckin {
  visitId: string;
  customerId: string;
  customerName: string;
  lat: number;
  lng: number;
  executiveName: string | null;
  at: string | null;
  type: string;
}
export interface MapRoute {
  userId: string;
  name: string;
  points: { lat: number; lng: number }[];
}
export interface MapActivity {
  positions: MapPosition[];
  checkins: MapCheckin[];
  routes: MapRoute[];
}
