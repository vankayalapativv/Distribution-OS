import { notFound, redirect } from "next/navigation";
import { InvoiceGenerate } from "@/features/invoices/invoice-generate";
import type { InvoiceEditData } from "@/features/invoices/invoice-generate-api";
import { dashboardForRole, requireSessionRole } from "@/features/auth/auth-role";
import { getApiAuthHeaders, requireAuthToken } from "@/features/auth/server-session";
import { serverApiFetch } from "@/lib/server-api";
import { getMetricsApiBaseUrl } from "@/features/dashboard/dashboard-api";

export const dynamic = "force-dynamic";

const GENERATE_ROLES = ["SUPER_ADMIN", "ACCOUNTANT"] as const;

export default async function EditInvoicePage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const auth = await requireSessionRole();
  if (!GENERATE_ROLES.includes(auth.role as (typeof GENERATE_ROLES)[number])) {
    redirect(dashboardForRole(auth.role));
  }

  const { id } = await params;
  const authToken = await requireAuthToken();

  const res = await serverApiFetch(`/invoices/${id}/edit-data`, { cache: "no-store", headers: await getApiAuthHeaders() });
  if (res.status === 404) notFound();
  // Not a generated invoice, cancelled, or otherwise not editable → back to the list.
  if (!res.ok) redirect("/invoices");
  const edit = ((await res.json()) as { data: InvoiceEditData }).data;
  if (!edit.editable) redirect(`/invoices?locked=${encodeURIComponent(edit.invoiceNumber)}`);

  return (
    <InvoiceGenerate
      role={auth.role as (typeof GENERATE_ROLES)[number]}
      actionConfig={{ apiBaseUrl: getMetricsApiBaseUrl(), authToken }}
      edit={edit}
    />
  );
}
