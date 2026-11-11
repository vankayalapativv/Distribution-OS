import { redirect } from "next/navigation";
import { StockEntryPage, type EntryType } from "../../../../features/stock/stock-entry";
import { dashboardForRole, requireSessionRole } from "../../../../features/auth/auth-role";
import { requireAuthToken } from "../../../../features/auth/server-session";
import { getMetricsApiBaseUrl } from "../../../../features/dashboard/dashboard-api";

export const dynamic = "force-dynamic";

// Stock writes are SUPER_ADMIN / MANAGER only (ACCOUNTANT reads the Journal).
const WRITE_ROLES = ["SUPER_ADMIN", "MANAGER"] as const;
const TYPES = ["in", "opening", "transfer", "adjust"] as const;

export default async function StockEntryRoute({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await requireSessionRole();
  if (!WRITE_ROLES.includes(auth.role as (typeof WRITE_ROLES)[number])) {
    redirect(dashboardForRole(auth.role));
  }

  const authToken = await requireAuthToken();
  const params = await searchParams;
  const raw = typeof params.type === "string" ? params.type : "";
  const initialType = (TYPES as readonly string[]).includes(raw) ? (raw as EntryType) : "in";

  return (
    <StockEntryPage
      role={auth.role as (typeof WRITE_ROLES)[number]}
      actionConfig={{ apiBaseUrl: getMetricsApiBaseUrl(), authToken }}
      initialType={initialType}
    />
  );
}
