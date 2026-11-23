import { redirect } from "next/navigation";
import { canAccessSection, dashboardForRole, requireSessionRole } from "../../../features/auth/auth-role";
import { requireAuthToken } from "../../../features/auth/server-session";
import {
  type CustomerLite,
  type SalesExecutive,
  getActionConfig,
  listCustomersLite,
  listMarketNotes,
  listMarketPhotos,
  listSalesExecutives,
} from "../../../features/market-intelligence/market-intelligence-api";
import { MarketIntelligenceView } from "../../../features/market-intelligence/market-intelligence-view";

export const dynamic = "force-dynamic";

export default async function MarketIntelligencePage() {
  const auth = await requireSessionRole();
  const authToken = await requireAuthToken();

  if (!canAccessSection(auth, "market-intelligence")) {
    redirect(dashboardForRole(auth.role));
  }

  // The note form links to customers, but a role can hold Market Intelligence
  // without the Customers section (e.g. a Manager whose Customers access was
  // revoked). Fetch customers only when permitted — otherwise the /customers
  // call 403s and crashes the page; fall back to an empty list instead.
  const customersFetch: Promise<CustomerLite[]> = canAccessSection(auth, "customers")
    ? listCustomersLite()
    : Promise.resolve([]);
  // The SE dropdown reads /orders/sales-executives, which is gated by the Orders
  // section. A role can hold Market Intelligence without Orders, so fetch the SE
  // list only when permitted — otherwise that 403 would crash the page.
  const salesExecsFetch: Promise<SalesExecutive[]> = canAccessSection(auth, "orders")
    ? listSalesExecutives()
    : Promise.resolve([]);
  const [photos, notes, salesExecutives, customers] = await Promise.all([
    listMarketPhotos(),
    listMarketNotes(),
    salesExecsFetch,
    customersFetch,
  ]);
  const config = getActionConfig();

  return (
    <MarketIntelligenceView
      photos={photos}
      notes={notes}
      salesExecutives={salesExecutives}
      customers={customers}
      role={auth.role as "SUPER_ADMIN" | "MANAGER"}
      actionConfig={{ ...config, authToken }}
    />
  );
}
