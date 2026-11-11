export interface DeliveryRunRow {
  runId: string;
  date: string;
  driverName: string | null;
  vehicleNumber: string | null;
  startedAt: string;
  endedAt: string | null;
  startOdometer: number | null;
  endOdometer: number | null;
  distanceKm: number | null;
  status: string;
  stopCount: number;
  photoCount: number;
}

export interface RunsSummary {
  runsToday: number;
  activeNow: number;
  stopsToday: number;
  distanceKm: number;
}

export interface OdometerPhoto {
  id: string;
  contentType: string | null;
}

export interface RunStop {
  stopId: string;
  customerId: string;
  customerName: string | null;
  customerCode: string | null;
  createdAt: string;
  latitude: number | null;
  longitude: number | null;
  photos: Array<{ id: string; contentType: string | null; createdAt: string }>;
}

export interface RunDetail {
  run: {
    runId: string;
    date: string;
    driverName: string | null;
    vehicleNumber: string | null;
    startedAt: string;
    endedAt: string | null;
    startOdometer: number | null;
    endOdometer: number | null;
    distanceKm: number | null;
    status: string;
    startPhoto: OdometerPhoto | null;
    endPhoto: OdometerPhoto | null;
  };
  stops: RunStop[];
}
