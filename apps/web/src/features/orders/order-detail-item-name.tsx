import type { OrderItem } from "./orders-api";

/** The "Item" cell: the product name. */
export function OrderDetailItemName({ item }: Readonly<{ item: OrderItem }>) {
  return <>{item.productName ?? "—"}</>;
}
