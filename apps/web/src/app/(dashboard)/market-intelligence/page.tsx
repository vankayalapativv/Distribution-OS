import { redirect } from "next/navigation";
import { canAccessSection, dashboardForRole, requireSessionRole } from "../../../features/auth/auth-role";
import { requireAuthToken } from "../../../features/auth/server-session";
import {
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

  const [photos, notes, salesExecutives, customers] = await Promise.all([
    listMarketPhotos(),
    listMarketNotes(),
    listSalesExecutives(),
    listCustomersLite(),
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
