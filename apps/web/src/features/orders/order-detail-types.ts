import type { Order, OrderItem } from "./order-types";

export interface OrderFulfillment {
  invoice: {
    id: string;
    code: string;
    date: string;
    total: number;
    outstanding: number;
    invoicedAt: string;
  } | null;
  delivery: { deliveredAt: string } | null;
}

/** One invoice on the order (partial delivery → several) + its delivery status. */
export interface Shipment {
  id: string;
  code: string;
  date: string;
  total: number;
  outstanding: number;
  oilLitres: number;
  invoicedAt: string;
  delivered: boolean;
  deliveredAt: string | null;
}

/** Per-SKU ordered vs invoiced-so-far → remaining. */
export interface SkuProgress {
  orderItemId: string;
  label: string;
  packSizeLitres: number | null;
  /** Live ordered quantity. After a short-close this is shrunk to the invoiced
   *  amount; the ORIGINAL ordered quantity is orderedUnits + cancelledUnits. */
  orderedUnits: number;
  /** Un-invoiced remainder cancelled by a short-close (0 for normal lines). */
  cancelledUnits: number;
  invoicedUnits: number;
  remainingUnits: number;
  /** Units returned via sales returns (may be 0). */
  returnedUnits: number;
}

export interface OrderDetail extends Order {
  items: OrderItem[];
  fulfillment: OrderFulfillment;
  shipments: Shipment[];
  skuProgress: SkuProgress[];
  /** Optional reason captured when the order was cancelled; null otherwise. */
  cancellationNote: string | null;
}
