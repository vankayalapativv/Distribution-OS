/** Read models for the delivery screen: active run and its stops. */
import type { LocalDb } from "./local-db";

export interface LocalDeliveryRun {
  clientUuid: string;
  serverId: string | null;
  vehicleNumber: string;
  startOdometer: number | null;
  endOdometer: number | null;
  status: string;
  startedAt: number;
}

export function getActiveDeliveryRun(db: LocalDb): LocalDeliveryRun | null {
  const row = db.first<{
    client_uuid: string;
    server_id: string | null;
    vehicle_number: string;
    start_odometer: number | null;
    end_odometer: number | null;
    status: string;
    started_at: number;
  }>(
    `select client_uuid, server_id, vehicle_number, start_odometer, end_odometer, status, started_at
     from delivery_runs where status = 'active' order by started_at desc limit 1`,
  );
  if (!row) return null;
  return {
    clientUuid: row.client_uuid,
    serverId: row.server_id,
    vehicleNumber: row.vehicle_number,
    startOdometer: row.start_odometer,
    endOdometer: row.end_odometer,
    status: row.status,
    startedAt: row.started_at,
  };
}

export interface LocalDeliveryStop {
  clientUuid: string;
  customerName: string | null;
  invoiceId: string | null;
  photoCount: number;
  createdAt: number;
}

export function getDeliveryStops(db: LocalDb, runClientUuid: string): LocalDeliveryStop[] {
  return db
    .all<{
      client_uuid: string;
      customer_name: string | null;
      invoice_id: string | null;
      photo_paths: string;
      created_at: number;
    }>(
      `select client_uuid, customer_name, invoice_id, photo_paths, created_at
       from delivery_stops where run_client_uuid = ? order by created_at desc`,
      [runClientUuid],
    )
    .map((r) => {
      let count = 0;
      try {
        const arr = JSON.parse(r.photo_paths) as unknown;
        if (Array.isArray(arr)) count = arr.length;
      } catch {
        count = 0;
      }
      return {
        clientUuid: r.client_uuid,
        customerName: r.customer_name,
        invoiceId: r.invoice_id,
        photoCount: count,
        createdAt: r.created_at,
      };
    });
}
