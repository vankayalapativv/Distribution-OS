export interface TrackedExecutive {
  userId: string;
  name: string;
  sessionStatus: string | null;
  startedAt: string | null;
  endedAt: string | null;
  pointCount: number;
  lastLatitude: number | null;
  lastLongitude: number | null;
  lastAccuracyMeters: number | null;
  lastRecordedAt: string | null;
  locationLabel?: string;
  lastHeartbeatAt?: string | null;
  batteryPercentage?: number | null;
  isLocationEnabled?: boolean | null;
  foregroundPermission?: string | null;
  backgroundPermission?: string | null;
  notificationPermission?: string | null;
  batteryOptimizationStatus?: string | null;
  networkType?: string | null;
  isConnected?: boolean | null;
  queuedPointCount?: number;
  lastSuccessfulSyncAt?: string | null;
  totalDistanceKm?: number | null;
  distanceAlgorithmVersion?: string | null;
  acceptedDistancePointCount?: number;
  rejectedDistancePointCount?: number;
  /** Whole-km odometer readings for the SE day (null until entered / day ends). */
  startOdometer?: number | null;
  endOdometer?: number | null;
  trackingStatus?: string;
  trackingStatusLabel?: string;
}

/** One tracked field user's latest device/permission health + today's ping count. */
export interface DeviceHealth {
  userId: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  androidVersion: string | null;
  appVersion: string | null;
  backgroundPermission: string | null;
  foregroundPermission: string | null;
  batteryOptimizationStatus: string | null;
  isLocationEnabled: boolean | null;
  lowPowerMode: boolean | null;
  networkType: string | null;
  isConnected: boolean | null;
  batteryPercentage: number | null;
  queuedPointCount: number;
  lastSuccessfulSyncAt: string | null;
  lastHeartbeatAt: string | null;
  todayPoints: number;
  lastRecordedAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  sessionStatus: string | null;
}

export interface RoutePoint {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  recordedAt: string;
}

/** An order produced during a visit (oil litres net of returns). */
export interface CheckinOrder {
  id: string;
  code: string;
  litres: number;
}

/** A collection made during a visit (₹). */
export interface CheckinCollection {
  id: string;
  code: string;
  amount: number;
}

/** One check-in for the selected executive on the viewed day: the GPS fix, the
 *  customer, the time, planned/unplanned, and the visit's inferred outcomes. */
export interface TrackingCheckin {
  visitId: string;
  customerId: string;
  customerName: string;
  lat: number;
  lng: number;
  checkInAt: string | null;
  planned: "planned" | "unplanned";
  orders: CheckinOrder[];
  collections: CheckinCollection[];
}
