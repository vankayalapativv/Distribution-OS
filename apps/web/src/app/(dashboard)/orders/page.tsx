import { redirect } from "next/navigation";
import { canAccessSection, canPerformAction, dashboardForRole, requireSessionRole } from "../../../features/auth/auth-role";
import {
  listProducts,
  listSalesExecutives,
  getActionConfig,
} from "../../../features/orders/orders-api";
import { type Customer, listCustomers } from "../../../features/customers/customers-api";
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
  // These lists still feed the filter selects + the create-order dialog. A role
  // can hold Orders without the Customers section (e.g. a Manager whose Customers
  // access was revoked); fetch customers only when permitted — otherwise the
  // /customers call 403s and crashes the page; fall back to an empty list.
  const customersFetch: Promise<Customer[]> = canAccessSection(auth, "customers")
    ? listCustomers()
    : Promise.resolve([]);
  const [products, customers, salesExecutives] = await Promise.all([
    listProducts(),
    customersFetch,
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
      canCreate={canPerformAction(auth, "orders.create")}
      canInvoice={canPerformAction(auth, "invoices.generate")}
      actionConfig={{ ...config, authToken }}
    />
  );
}
