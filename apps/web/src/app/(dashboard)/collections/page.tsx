import { redirect } from "next/navigation";
import { canAccessSection, dashboardForRole, requireSessionRole } from "../../../features/auth/auth-role";
import { getActionConfig, listCollectors } from "../../../features/collections/collections-api";
import { listCustomers } from "../../../features/customers/customers-api";
import { CollectionsList } from "../../../features/collections/collections-list";
import { requireAuthToken } from "../../../features/auth/server-session";

export const dynamic = "force-dynamic";

export default async function CollectionsPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await requireSessionRole();
  const authToken = await requireAuthToken();

  if (!canAccessSection(auth, "collections")) {
    redirect(dashboardForRole(auth.role));
  }

  const params = await searchParams;
  const str = (v: string | string[] | undefined) =>
    typeof v === "string" && v.length > 0 ? v : undefined;

  // The table is fetched client-side with TanStack Query. `customers` +
  // `collectors` feed the create-collection dialog; the ?status= deep-link
  // seeds the filter. Only SUPER_ADMIN/MANAGER record collections, so the
  // collectors list (which that endpoint scopes to those roles) is skipped
  // for ACCOUNTANT.
  const canCreate = auth.role === "SUPER_ADMIN" || auth.role === "MANAGER";
  const [customers, collectors] = await Promise.all([
    listCustomers(),
    canCreate ? listCollectors() : Promise.resolve([]),
  ]);
  const config = getActionConfig();

  return (
    <CollectionsList
      customers={customers.map((c) => ({
        id: c.id,
        legalName: c.legalName,
        addressCity: c.addressCity,
        salesExecutiveName: c.salesExecutiveName,
      }))}
      collectors={collectors}
      role={auth.role as "SUPER_ADMIN" | "MANAGER" | "ACCOUNTANT"}
      actionConfig={{ ...config, authToken }}
      initialStatus={str(params.status)}
    />
  );
}
