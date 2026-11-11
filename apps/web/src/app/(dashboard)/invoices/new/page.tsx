import { redirect } from "next/navigation";
import { InvoiceGenerate } from "../../../../features/invoices/invoice-generate";
import { orderToInvoiceSeed, type OrderInvoiceSeed } from "../../../../features/invoices/invoice-generate-api";
import { getOrder } from "../../../../features/orders/orders-api";
import { dashboardForRole, requireSessionRole } from "../../../../features/auth/auth-role";
import { requireAuthToken } from "../../../../features/auth/server-session";
import { getMetricsApiBaseUrl } from "../../../../features/dashboard/dashboard-api";

export const dynamic = "force-dynamic";

const GENERATE_ROLES = ["SUPER_ADMIN", "ACCOUNTANT"] as const;

export default async function NewInvoicePage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await requireSessionRole();

  if (!GENERATE_ROLES.includes(auth.role as (typeof GENERATE_ROLES)[number])) {
    redirect(dashboardForRole(auth.role));
  }

  const authToken = await requireAuthToken();

  // When opened from an order ("Create Invoice"), pre-fill customer + lines.
  const params = await searchParams;
  const orderId = typeof params.orderId === "string" ? params.orderId : null;
  let seed: OrderInvoiceSeed | null = null;
  if (orderId) {
    try {
      seed = orderToInvoiceSeed(await getOrder(orderId));
    } catch {
      seed = null; // missing/forbidden order → fall back to a blank invoice
    }
  }

  return (
    <InvoiceGenerate
      role={auth.role as (typeof GENERATE_ROLES)[number]}
      actionConfig={{ apiBaseUrl: getMetricsApiBaseUrl(), authToken }}
      seed={seed}
    />
  );
}
