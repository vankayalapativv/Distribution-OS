import { redirect } from "next/navigation";
import { InvoicesList } from "../../../features/invoices/invoices-list";
import { canAccessSection, canPerformAction, dashboardForRole, requireSessionRole } from "../../../features/auth/auth-role";
import { requireAuthToken } from "../../../features/auth/server-session";
import { getMetricsApiBaseUrl } from "../../../features/dashboard/dashboard-api";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const auth = await requireSessionRole();

  if (!canAccessSection(auth, "invoices")) {
    redirect(dashboardForRole(auth.role));
  }

  const authToken = await requireAuthToken();

  return (
    <InvoicesList
      role={auth.role}
      canGenerate={canPerformAction(auth, "invoices.generate")}
      actionConfig={{ apiBaseUrl: getMetricsApiBaseUrl(), authToken }}
    />
  );
}
