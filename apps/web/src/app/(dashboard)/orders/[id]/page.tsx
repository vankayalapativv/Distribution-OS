import { notFound } from "next/navigation";
import { requireSectionAccess } from "../../../../features/auth/auth-role";
import { getOrder } from "../../../../features/orders/orders-api";
import { OrderDetailView } from "../../../../features/orders/order-detail";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  // Same configurable section gate as the orders LIST page, so a revoked
  // `section:orders` permission also blocks the detail route (not just the list).
  const auth = await requireSectionAccess("orders");
  const { id } = await params;

  let order;
  try {
    order = await getOrder(id);
  } catch {
    notFound();
  }

  return (
    <OrderDetailView
      order={order}
      role={auth.role as "SUPER_ADMIN" | "MANAGER" | "ACCOUNTANT"}
    />
  );
}
