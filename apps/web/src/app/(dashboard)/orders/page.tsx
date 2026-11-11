import { redirect } from "next/navigation";
import { canAccessSection, dashboardForRole, requireSessionRole } from "../../../features/auth/auth-role";
import {
  listProducts,
  listSalesExecutives,
  getActionConfig,
} from "../../../features/orders/orders-api";
import { listCustomers } from "../../../features/customers/customers-api";
import { OrdersList } from "../../../features/orders/orders-list";
import { requireAuthToken } from "../../../features/auth/server-session";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const auth = await requireSessionRole();
  const authToken = await requireAuthToken();

  if (!canAccessSection(auth, "orders")) {
    redirect(dashboardForRole(auth.role));
  }

  // The orders table is fetched client-side with TanStack Query (see orders-list).
  // These lists still feed the filter selects + the create-order dialog.
  const [products, customers, salesExecutives] = await Promise.all([
    listProducts(),
    listCustomers(),
    listSalesExecutives(),
  ]);

  const config = getActionConfig();

  return (
    <OrdersList
      products={products}
      customers={customers.map((c) => ({
        id: c.id,
        legalName: c.legalName,
        addressCity: c.addressCity,
        salesExecutiveName: c.salesExecutiveName,
      }))}
      salesExecutives={salesExecutives}
      role={auth.role as "SUPER_ADMIN" | "MANAGER" | "ACCOUNTANT"}
      actionConfig={{ ...config, authToken }}
    />
  );
}
