export interface DeliveryCustomerRow {
  customerId: string;
  customerName: string | null;
  customerCode: string | null;
  area: string | null;
  deliveryCount: number;
  lastDeliveryDate: string;
  photoCount: number;
}

export interface DeliveryStopRow {
  stopId: string;
  runId: string;
  date: string;
  createdAt: string;
  customerId: string;
  customerName: string | null;
  customerCode: string | null;
  driverName: string | null;
  vehicleNumber: string | null;
  latitude: number | null;
  longitude: number | null;
  photoCount: number;
}

export interface DeliveryPhoto {
  id: string;
  contentType: string | null;
  createdAt: string;
}

export interface DeliveryEvent {
  stopId: string;
  runId: string;
  date: string;
  createdAt: string;
  driverName: string | null;
  vehicleNumber: string | null;
  latitude: number | null;
  longitude: number | null;
  photos: DeliveryPhoto[];
}

export interface CustomerDeliveryDetail {
  customer: {
    customerId: string;
    customerName: string | null;
    customerCode: string | null;
    phone: string | null;
    address: string | null;
    landmark: string | null;
  };
  events: DeliveryEvent[];
}

export interface Paged<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function getActionConfig(): { apiBaseUrl: string } {
  return {
    apiBaseUrl: process.env.SRI_APARAJITA_API_BASE_URL ?? "http://localhost:8787/api/v1",
  };
}
