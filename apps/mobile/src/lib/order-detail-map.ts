/**
 * Order-detail shapes + the server → view mapping. Split out of order-detail.ts
 * so that module stays small; it re-exports the public types from here.
 */
export interface OrderDetailItem {
  name: string;
  kind: "oil";
  quantityUnits: number;
  packSizeLitres: number | null;
  totalLitres: number | null;
  segment: string | null;
}

export interface OrderDetail {
  orderCode: string | null;
  orderDate: string | null;
  orderStatus: string | null;
  totalLitres: number;
  items: OrderDetailItem[];
}

/** A numeric column as the server may send it (number, numeric string, or null). */
type ServerNumeric = number | string | null;

export interface ServerOrderItem {
  productName: string | null;
  quantityUnits: ServerNumeric;
  packSizeLitres: ServerNumeric;
  totalLitres: ServerNumeric;
  segment: string | null;
}

export interface ServerOrder {
  orderCode: string;
  orderDate: string;
  orderStatus: string;
  totalLitres: ServerNumeric;
  items: ServerOrderItem[];
}

function num(v: ServerNumeric | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function mapServerItem(item: ServerOrderItem): OrderDetailItem {
  return {
    name: item.productName ?? "Item",
    kind: "oil",
    quantityUnits: num(item.quantityUnits),
    packSizeLitres: item.packSizeLitres == null ? null : num(item.packSizeLitres),
    totalLitres: item.totalLitres == null ? null : num(item.totalLitres),
    segment: item.segment ?? null,
  };
}

export function mapServerOrder(order: ServerOrder): OrderDetail {
  return {
    orderCode: order.orderCode ?? null,
    orderDate: order.orderDate ? String(order.orderDate).slice(0, 10) : null,
    orderStatus: order.orderStatus ?? null,
    totalLitres: num(order.totalLitres),
    items: (order.items ?? []).map(mapServerItem),
  };
}
